
import pg from "pg";
import { createClient } from "redis";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";

import MatchService from "../../../src/services/MatchService.js";
import RedisCache from "../../../src/cache/RedisCache.js";
import { CacheKeys } from "../../../src/cache/CacheKeys.js";
import CacheInvalidationWorker from
  "../../../src/workers/CacheInvalidationWorker.js";
import PostgresCacheInvalidationRepository from
  "../../../src/repositories/postgres/PostgresCacheInvalidationRepository.js";

const REDIS_URL = "redis://127.0.0.1:56379";

const testDatabaseUrl = new URL(
  process.env.TEST_DATABASE_URL ||
    "postgresql://invalid@invalid/invalid"
);

if (
  !["127.0.0.1", "localhost"].includes(testDatabaseUrl.hostname) ||
  testDatabaseUrl.port !== "5432" ||
  testDatabaseUrl.pathname !== "/criczone_resilience"
) {
  throw new Error(
    "Resilience benchmark requires the isolated CI PostgreSQL database"
  );
}

const OUTPUT =
  "benchmarks/resilience/valkey/reports/consistency.json";

// This benchmark intentionally controls a Docker container.
// It must run only in the isolated GitHub Actions test setup.
if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.NODE_ENV !== "test" ||
  process.env.REDIS_URL !== REDIS_URL ||
  process.env.TEST_REDIS_URL !== REDIS_URL ||
  !process.env.TEST_DATABASE_URL ||
  (
    process.env.DATABASE_URL &&
    process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
  )
) {
  throw new Error("Isolated test environment required");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function docker(...args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 15000
  }).trim();
}

async function waitFor(predicate, timeoutMs) {
  const start = performance.now();

  while (performance.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }

    await sleep(50);
  }

  return false;
}

function findValkeyContainer() {
  const ids = docker(
    "ps",
    "--filter",
    "publish=56379",
    "--format",
    "{{.ID}}"
  )
    .split("\n")
    .filter(Boolean);

  assert(
    ids.length === 1,
    "Expected exactly one isolated Valkey container"
  );

  const image = docker(
    "inspect",
    "--format",
    "{{.Config.Image}}",
    ids[0]
  );

  assert(
    image === "valkey/valkey:8-alpine",
    "Unexpected Docker container image"
  );

  return ids[0];
}

const runId = randomUUID();

const matchId = Math.floor(
  900000000 + Math.random() * 99999999
);

const cacheKey = CacheKeys.matchById(matchId);

const db = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
  connectionTimeoutMillis: 10000,
  query_timeout: 10000
});

const redis = createClient({
  url: REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 3000,
    reconnectStrategy: retries =>
      Math.min(250 * retries, 1000)
  }
});

const warnings = [];

let reconnectEvents = 0;
let readyEvents = 0;
let repositoryReads = 0;
let cacheSetCalls = 0;

let restoreRequired = false;
let dbConnected = false;

redis.on("error", () => {});
redis.on("reconnecting", () => reconnectEvents++);
redis.on("ready", () => readyEvents++);

const cache = new RedisCache(redis, {
  warn(message, details) {
    warnings.push({
      message,
      errorMessage: details?.errorMessage
    });
  }
});

// Track cache SET attempts.
const originalCacheSet = cache.set.bind(cache);

cache.set = async (...args) => {
  cacheSetCalls++;
  return originalCacheSet(...args);
};

// Uses a temporary table instead of production match records.
// The real MatchService calls this repository through findById.
const matchRepository = {
  async findById(id) {
    repositoryReads++;

    const result = await db.query(
      `
        SELECT payload
        FROM criczone_resilience_matches
        WHERE id = $1
      `,
      [id]
    );

    return result.rows[0]?.payload ?? null;
  }
};

const invalidationRepository =
  new PostgresCacheInvalidationRepository(db);

const matchService = new MatchService(
  matchRepository,
  cache,
  invalidationRepository
);

// This adapter reuses the benchmark's database connection.
// Safe only for this sequential single-client test.
// A production worker should use a PostgreSQL connection pool.
const workerDatabase = {
  async getClient() {
    return {
      query: (...args) => db.query(...args),
      release() {}
    };
  },

  query: (...args) => db.query(...args)
};

const worker = new CacheInvalidationWorker(
  workerDatabase,
  redis,
  {
    info() {},

    error(message, details) {
      warnings.push({
        message,
        errorMessage: details?.errorMessage
      });
    }
  }
);

const report = {
  module: "25.7.2.6",
  scenario: "transactional_outbox_cache_consistency",

  runId,

  baselineHealthy: false,
  cacheInitiallyPopulated: false,

  outageDetected: false,
  invalidationPersisted: false,

  fallbackReadFromPostgres: false,
  cacheWriteSkippedWhilePending: false,

  redisReconnected: false,
  staleCachePreservedBeforeWorker: false,
  pendingReadBypassedCache: false,

  workerProcessed: false,
  staleCacheRemoved: false,
  outboxCompleted: false,

  outboxConsistencyPassed: false,
  repairSucceeded: false,

  repositoryReads: 0,
  cacheSetCalls: 0,

  warnings: [],
  failures: [],

  passed: false
};

let containerId = null;

try {
  containerId = findValkeyContainer();

  await db.connect();
  dbConnected = true;

  const tableCheck = await db.query(
    `
      SELECT to_regclass(
        'public.cache_invalidation_outbox'
      ) AS table_name
    `
  );

  assert(
    tableCheck.rows[0]?.table_name != null,
    "Outbox migration missing from isolated test database"
  );

  await redis.connect();

  assert(
    await redis.ping() === "PONG",
    "Valkey baseline health check failed"
  );

  report.baselineHealthy = true;

  await db.query(`
    CREATE TEMP TABLE criczone_resilience_matches (
      id BIGINT PRIMARY KEY,
      payload JSONB NOT NULL
    )
  `);

  const originalMatch = {
    id: matchId,
    runs: 100,
    wickets: 2,
    version: 1
  };

  const updatedMatch = {
    id: matchId,
    runs: 104,
    wickets: 2,
    version: 2
  };

  await db.query(
    `
      INSERT INTO criczone_resilience_matches (
        id,
        payload
      )
      VALUES ($1, $2::jsonb)
    `,
    [
      matchId,
      JSON.stringify(originalMatch)
    ]
  );

  const initialRead =
    await matchService.getMatchById(matchId);

  assert(
    initialRead.version === 1,
    "Initial PostgreSQL read returned incorrect data"
  );

  const cachedRaw = await redis.get(cacheKey);

  report.cacheInitiallyPopulated =
    cachedRaw !== null &&
    JSON.parse(cachedRaw).version === 1;

  assert(
    report.cacheInitiallyPopulated,
    "Initial cache population failed"
  );

  restoreRequired = true;

  docker(
    "stop",
    "--time",
    "1",
    containerId
  );

  report.outageDetected = await waitFor(
    () => !redis.isReady && reconnectEvents > 0,
    5000
  );

  assert(
    report.outageDetected,
    "Valkey outage was not detected"
  );

  // Simulates recordBall() transaction semantics using
  // a temporary match table and the real outbox table.
  //
  // The data update and invalidation event must commit
  // together or roll back together.
  await db.query("BEGIN");

  try {
    await db.query(
      `
        UPDATE criczone_resilience_matches
        SET payload = $2::jsonb
        WHERE id = $1
      `,
      [
        matchId,
        JSON.stringify(updatedMatch)
      ]
    );

    await db.query(
      `
        INSERT INTO public.cache_invalidation_outbox (
          event_id,
          match_id,
          cache_keys,
          status
        )
        VALUES ($1, $2, $3::jsonb, 'PENDING')
      `,
      [
        runId,
        matchId,
        JSON.stringify([cacheKey])
      ]
    );

    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  report.invalidationPersisted =
    await invalidationRepository.hasPendingInvalidation(
      matchId
    );

  assert(
    report.invalidationPersisted,
    "Outbox invalidation event was not persisted"
  );

  const readsBeforeFallback = repositoryReads;
  const writesBeforeFallback = cacheSetCalls;

  const fallback =
    await matchService.getMatchById(matchId);

  report.fallbackReadFromPostgres =
    fallback.version === 2 &&
    repositoryReads > readsBeforeFallback;

  report.cacheWriteSkippedWhilePending =
    cacheSetCalls === writesBeforeFallback;

  assert(
    report.fallbackReadFromPostgres,
    "PostgreSQL fallback returned stale data"
  );

  assert(
    report.cacheWriteSkippedWhilePending,
    "Cache write attempted while invalidation was pending"
  );

  docker("start", containerId);

  report.redisReconnected = await waitFor(
    () => redis.isReady && readyEvents >= 2,
    15000
  );

  assert(
    report.redisReconnected,
    "Valkey failed to reconnect"
  );

  assert(
    await redis.ping() === "PONG",
    "Valkey PING failed after recovery"
  );

  const staleRaw = await redis.get(cacheKey);

  report.staleCachePreservedBeforeWorker =
    staleRaw !== null &&
    JSON.parse(staleRaw).version === 1;

  assert(
    report.staleCachePreservedBeforeWorker,
    "Expected stale version 1 before invalidation"
  );

  const readsBeforePendingCheck = repositoryReads;
  const writesBeforePendingCheck = cacheSetCalls;

  const pendingRead =
    await matchService.getMatchById(matchId);

  report.pendingReadBypassedCache =
    pendingRead.version === 2 &&
    repositoryReads > readsBeforePendingCheck &&
    cacheSetCalls === writesBeforePendingCheck;

  assert(
    report.pendingReadBypassedCache,
    "Pending invalidation did not bypass stale cache"
  );

  // The stale value should remain untouched until the worker.
  assert(
    JSON.parse(await redis.get(cacheKey)).version === 1,
    "Unexpected cache modification before worker execution"
  );

  report.workerProcessed =
    await worker.processOne();

  assert(
    report.workerProcessed,
    "Outbox worker failed to process pending event"
  );

  report.staleCacheRemoved =
    (await redis.get(cacheKey)) === null;

  assert(
    report.staleCacheRemoved,
    "Worker failed to remove stale cache key"
  );

  report.outboxCompleted =
    !(
      await invalidationRepository.hasPendingInvalidation(
        matchId
      )
    );

  assert(
    report.outboxCompleted,
    "Outbox invalidation remains pending"
  );

  const readsBeforeRepair = repositoryReads;

  const freshRead =
    await matchService.getMatchById(matchId);

  const freshCached =
    await cache.get(cacheKey);

  report.repairSucceeded =
    freshRead.version === 2 &&
    freshCached?.version === 2 &&
    repositoryReads > readsBeforeRepair;

  assert(
    report.repairSucceeded,
    "Fresh cache population failed"
  );

  const readsBeforeFinalHit = repositoryReads;

  const finalRead =
    await matchService.getMatchById(matchId);

  assert(
    finalRead.version === 2,
    "Final read returned stale data"
  );

  assert(
    repositoryReads === readsBeforeFinalHit,
    "Expected a cache hit after successful recovery"
  );

  // Tests consistency with a directly invoked worker,
  // not background polling.
  report.outboxConsistencyPassed =
    report.invalidationPersisted &&
    report.pendingReadBypassedCache &&
    report.workerProcessed &&
    report.staleCacheRemoved &&
    report.outboxCompleted &&
    report.repairSucceeded;

} catch (error) {
  report.failures.push(error.message);

} finally {
  // Restore the isolated Valkey container.
  try {
    if (restoreRequired && containerId) {
      const running = docker(
        "inspect",
        "--format",
        "{{.State.Running}}",
        containerId
      );

      if (running !== "true") {
        docker("start", containerId);
      }
    }
  } catch (error) {
    report.failures.push(
      `Valkey cleanup: ${error.message}`
    );
  }

  // Cleanup must wait for Valkey recovery.
  try {
    if (report.cacheInitiallyPopulated) {
      const ready = await waitFor(
        () => redis.isReady,
        15000
      );

      assert(
        ready,
        "Valkey did not recover in time for key cleanup"
      );

      await redis.del(cacheKey);
    }
  } catch (error) {
    report.failures.push(
      `Redis key cleanup: ${error.message}`
    );
  }

  // Close the Redis client.
  if (redis.isOpen) {
    redis.destroy();
  }

  // Remove only this benchmark's outbox record.
  try {
    if (dbConnected) {
      await db.query(
        `
          DELETE FROM public.cache_invalidation_outbox
          WHERE event_id = $1
            AND match_id = $2
        `,
        [runId, matchId]
      );
    }
  } catch (error) {
    report.failures.push(
      `Outbox cleanup: ${error.message}`
    );
  }

  // Close PostgreSQL.
  try {
    if (dbConnected) {
      await db.end();
    }
  } catch (error) {
    report.failures.push(
      `Database cleanup: ${error.message}`
    );
  }

  report.repositoryReads = repositoryReads;
  report.cacheSetCalls = cacheSetCalls;
  report.warnings = warnings;

  report.passed =
    report.failures.length === 0 &&
    report.baselineHealthy &&
    report.cacheInitiallyPopulated &&
    report.outageDetected &&
    report.invalidationPersisted &&
    report.fallbackReadFromPostgres &&
    report.cacheWriteSkippedWhilePending &&
    report.redisReconnected &&
    report.staleCachePreservedBeforeWorker &&
    report.pendingReadBypassedCache &&
    report.workerProcessed &&
    report.staleCacheRemoved &&
    report.outboxCompleted &&
    report.outboxConsistencyPassed &&
    report.repairSucceeded;

  fs.mkdirSync(
    "benchmarks/resilience/valkey/reports",
    { recursive: true }
  );

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
}

if (!report.passed) {
  process.exitCode = 1;
}

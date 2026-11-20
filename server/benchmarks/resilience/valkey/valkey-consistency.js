
import pg from "pg";
import { createClient } from "rediss";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";

import MatchService from "../../../src/services/MatchService.js";
import RedisCache from "../../../src/cache/RedisCache.js";
import { CacheKeys } from "../../../src/cache/CacheKeys.js";

const REDIS_URL = "redis://127.0.0.1:56379";
const OUTPUT =
  "benchmarks/resilience/valkey/reports/consistency.json";

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.NODE_ENV !== "test" ||
  process.env.REDIS_URL !== REDIS_URL ||
  !process.env.TEST_DATABASE_URL ||
  (
    process.env.DATABASE_URL &&
    process.env.TEST_DATABASE_URL === process.env.DATABASE_URL
  )
) {
  throw new Error("Isolated test environment required");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function docker(...args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 15000
  }).trim();
}

async function waitFor(predicate, timeoutMs) {
  const started = performance.now();

  while (performance.now() - started < timeoutMs) {
    if (predicate()) return true;
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
  ).split("\n").filter(Boolean);

  assert(ids.length === 1, "Expected one Valkey container");

  const image = docker(
    "inspect",
    "--format",
    "{{.Config.Image}}",
    ids[0]
  );

  assert(
    image === "valkey/valkey:8-alpine",
    "Unexpected Docker image"
  );

  return ids[0];
}

const runId = randomUUID();
const matchId = Math.floor(
  900000000 + Math.random() * 99999999
);
const cacheKey = CacheKeys.matchById(matchId);

const containerId = findValkeyContainer();

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
let restoreRequired = false;

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

// PostgreSQL-backed test repository.
// Uses the same findById interface as CricZone.
const repository = {
  async findById(id) {
    repositoryReads++;

    const result = await db.query(
      `SELECT payload
       FROM criczone_resilience_matches
       WHERE id = $1`,
      [id]
    );

    return result.rows[0]?.payload ?? null;
  }
};

// This is the actual CricZone service.
const service = new MatchService(repository, cache);

const report = {
  module: "25.7.2.6",
  scenario: "postgres_fallback_and_cache_consistency",
  runId,
  baselineHealthy: false,
  cacheInitiallyPopulated: false,
  outageDetected: false,
  fallbackReadFromPostgres: false,
  cacheWriteFailureLogged: false,
  redisReconnected: false,
  staleReadAfterRecovery: null,
  automaticConsistencyPassed: false,
  repairSucceeded: false,
  repositoryReads: 0,
  warnings: [],
  failures: [],
  passed: false
};

try {
  await db.connect();
  await redis.connect();

  assert(await redis.ping() === "PONG", "Valkey unhealthy");
  report.baselineHealthy = true;

  // Temporary table exists only in this PostgreSQL session.
  await db.query(`
    CREATE TEMP TABLE criczone_resilience_matches (
      id BIGINT PRIMARY KEY,
      payload JSONB NOT NULL
    )
  `);

  const original = {
    id: matchId,
    runs: 100,
    wickets: 2,
    version: 1
  };

  const updated = {
    id: matchId,
    runs: 104,
    wickets: 2,
    version: 2
  };

  await db.query(
    `INSERT INTO criczone_resilience_matches
     (id, payload) VALUES ($1, $2::jsonb)`,
    [matchId, JSON.stringify(original)]
  );

  // 1. Populate Valkey through the real MatchService.
  const firstRead = await service.getMatchById(matchId);

  assert(firstRead.version === 1, "Initial read incorrect");

  const cached = await redis.get(cacheKey);

  report.cacheInitiallyPopulated =
    JSON.parse(cached).version === 1;

  assert(report.cacheInitiallyPopulated, "Cache not populated");

  // 2. Stop isolated Valkey.
  restoreRequired = true;
  docker("stop", "--time", "1", containerId);

  report.outageDetected = await waitFor(
    () => !redis.isReady && reconnectEvents > 0,
    5000
  );

  assert(report.outageDetected, "Outage not detected");

  // 3. Simulate authoritative PostgreSQL data changing.
  await db.query(
    `UPDATE criczone_resilience_matches
     SET payload = $2::jsonb
     WHERE id = $1`,
    [matchId, JSON.stringify(updated)]
  );

  const readsBeforeFallback = repositoryReads;

  // 4. CricZone must read from PostgreSQL while Redis is down.
  const fallback = await service.getMatchById(matchId);

  report.fallbackReadFromPostgres =
    fallback.version === 2 &&
    repositoryReads > readsBeforeFallback;

  report.cacheWriteFailureLogged = warnings.some(
    warning => warning.message === "Redis cache SET failed"
  );

  assert(
    report.fallbackReadFromPostgres,
    "PostgreSQL fallback returned incorrect data"
  );

  assert(
    report.cacheWriteFailureLogged,
    "Expected cache SET failure warning missing"
  );

  // 5. Restart Valkey.
  docker("start", containerId);

  report.redisReconnected = await waitFor(
    () => redis.isReady && readyEvents >= 2,
    15000
  );

  assert(report.redisReconnected, "Redis failed to reconnect");

  // 6. Check whether the service returns stale cached data.
  const afterRecovery =
    await service.getMatchById(matchId);

  report.staleReadAfterRecovery =
    afterRecovery.version !== 2;

  report.automaticConsistencyPassed =
    !report.staleReadAfterRecovery;

  // 7. Verify that explicit invalidation repairs the cache.
  await cache.delete(cacheKey);

  const repaired = await service.getMatchById(matchId);

  const repairedCache = await cache.get(cacheKey);

  report.repairSucceeded =
    repaired.version === 2 &&
    repairedCache?.version === 2;

  assert(report.repairSucceeded, "Cache repair failed");

} catch (error) {
  report.failures.push(error.message);

} finally {
  // Restore Valkey even if a test fails.
  try {
    if (restoreRequired) {
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
    report.failures.push(`Cleanup: ${error.message}`);
  }

  try {
    if (redis.isReady) {
      await redis.del(cacheKey);
    }
  } catch {
    // Test cleanup is best-effort.
  }

  if (redis.isOpen) redis.destroy();

  try {
    await db.end();
  } catch (error) {
    report.failures.push(`Database cleanup: ${error.message}`);
  }

  report.repositoryReads = repositoryReads;
  report.warnings = warnings;

  report.passed =
    report.failures.length === 0 &&
    report.baselineHealthy &&
    report.cacheInitiallyPopulated &&
    report.outageDetected &&
    report.fallbackReadFromPostgres &&
    report.cacheWriteFailureLogged &&
    report.redisReconnected &&
    report.automaticConsistencyPassed &&
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

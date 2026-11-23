
/**
 * CricZone Phase 25.7.6.1
 * PostgreSQL + Valkey consistency after interrupted invalidation.
 *
 * Uses real CricZone service, cache, repository and worker.
 * Runs only against isolated GitHub Actions services.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { createClient } from "redis";

import MatchService from "../../../src/services/MatchService.js";
import RedisCache from "../../../src/cache/RedisCache.js";
import { CacheKeys } from "../../../src/cache/CacheKeys.js";
import PostgresCacheInvalidationRepository from "../../../src/repositories/postgres/PostgresCacheInvalidationRepository.js";
import CacheInvalidationWorker from "../../../src/workers/CacheInvalidationWorker.js";

const DB_URL =
  "postgresql://criczone_test:criczone_test_password@127.0.0.1:55433/criczone_resilience";

const REDIS_URL = "redis://127.0.0.1:56381";

const OUTPUT = path.resolve(
  "benchmarks/resilience/consistency/reports/cache-recovery.json"
);

const runId = randomUUID();
const matchId = 950000000 + Math.floor(Math.random() * 10000000);
const cacheKey = CacheKeys.matchById(matchId);

const logger = {
  info() {},
  warn() {},
  error() {}
};

const report = {
  phase: "25.7.6.1",
  scenario: "postgres_valkey_interrupted_invalidation_consistency",
  runId,
  isolated: false,
  authoritativeDatabasePreserved: false,
  staleCacheNeverServed: false,
  failedWorkerRollbackConfirmed: false,
  pendingOutboxRetained: false,
  retryCompleted: false,
  cacheRepaired: false,
  duplicateOutboxRejected: false,
  secondUpdateConsistent: false,
  finalVersion: null,
  finalRuns: null,
  failures: [],
  warnings: [
    "This validates match snapshot/cache consistency, not ball-level scoring.",
    "Kafka and WebSocket delivery are outside this test.",
    "The failure is injected into the worker Redis deletion dependency.",
    "The test uses isolated CI PostgreSQL and Valkey services."
  ],
  passed: false
};

function verifyIsolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.TEST_DATABASE_URL, DB_URL);
  assert.equal(process.env.TEST_REDIS_URL, REDIS_URL);

  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(process.env.REDIS_URL, undefined);
  assert.equal(process.env.KAFKA_BROKERS, undefined);

  report.isolated = true;
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: false,
  max: 5,
  connectionTimeoutMillis: 2000,
  statement_timeout: 5000
});

pool.on("error", error => {
  report.failures.push(
    `PostgreSQL pool: ${error.message}`
  );
});

const redis = createClient({
  url: REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 2000,
    reconnectStrategy: false
  }
});

redis.on("error", error => {
  report.failures.push(
    `Redis client: ${error.message}`
  );
});

const repository = {
  async findById(id) {
    const result = await pool.query(
      `SELECT payload
       FROM resilience_consistency_matches
       WHERE id = $1`,
      [id]
    );

    return result.rows[0]?.payload ?? null;
  }
};

const cache = new RedisCache(redis, logger);

const invalidationRepository =
  new PostgresCacheInvalidationRepository(pool);

const matchService = new MatchService(
  repository,
  cache,
  invalidationRepository
);

function snapshot(version, runs) {
  return {
    id: matchId,
    version,
    runs,
    wickets: 2
  };
}

async function readMatch() {
  return matchService.getMatchById(matchId);
}

async function assertMatch(version, runs) {
  const value = await readMatch();

  assert.equal(value.id, matchId);
  assert.equal(value.version, version);
  assert.equal(value.runs, runs);

  return value;
}

async function outboxStatus(eventId) {
  const result = await pool.query(
    `SELECT id, status, attempts
     FROM public.cache_invalidation_outbox
     WHERE event_id = $1`,
    [eventId]
  );

  return result.rows[0] ?? null;
}

async function commitMatchUpdate(eventId, version, runs) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updated = await client.query(
      `UPDATE resilience_consistency_matches
       SET payload = $2::jsonb
       WHERE id = $1`,
      [
        matchId,
        JSON.stringify(snapshot(version, runs))
      ]
    );

    assert.equal(updated.rowCount, 1);

    await client.query(
      `INSERT INTO public.cache_invalidation_outbox
         (event_id, match_id, cache_keys, status)
       VALUES ($1, $2, $3::jsonb, 'PENDING')`,
      [
        eventId,
        matchId,
        JSON.stringify([cacheKey])
      ]
    );

    await client.query("COMMIT");

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original error.
    }

    throw error;

  } finally {
    client.release();
  }
}

function makeWorker(redisClient) {
  return new CacheInvalidationWorker(
    {
      getClient: () => pool.connect(),
      query: (...args) => pool.query(...args)
    },
    redisClient,
    logger
  );
}

async function main() {
  verifyIsolation();

  await pool.query("SELECT 1");

  await redis.connect();

  assert.equal(await redis.ping(), "PONG");

  await pool.query(`
    CREATE TABLE resilience_consistency_matches (
      id BIGINT PRIMARY KEY,
      payload JSONB NOT NULL
    )
  `);

  // Baseline authoritative state.
  await pool.query(
    `INSERT INTO resilience_consistency_matches
       (id, payload)
     VALUES ($1, $2::jsonb)`,
    [
      matchId,
      JSON.stringify(snapshot(1, 100))
    ]
  );

  await assertMatch(1, 100);

  // Confirm baseline snapshot is cached.
  const cachedV1 = JSON.parse(
    await redis.get(cacheKey)
  );

  assert.equal(cachedV1.version, 1);

  // Commit a new match version and outbox event together.
  const firstEventId = randomUUID();

  await commitMatchUpdate(
    firstEventId,
    2,
    104
  );

  assert.equal(
    (await outboxStatus(firstEventId)).status,
    "PENDING"
  );

  // Redis is deliberately still stale.
  assert.equal(
    JSON.parse(await redis.get(cacheKey)).version,
    1
  );

  // MatchService must return PostgreSQL version 2
  // despite stale cache version 1.
  for (let i = 0; i < 20; i++) {
    await assertMatch(2, 104);
  }

  report.staleCacheNeverServed = true;
  report.authoritativeDatabasePreserved = true;

  // Inject one cache-deletion failure.
  // This exercises the real worker's transaction/rollback
  // logic while PostgreSQL and Valkey remain real services.
  const faultyRedis = {
    async del() {
      throw new Error(
        "Injected cache deletion failure"
      );
    }
  };

  const failedWorker = makeWorker(faultyRedis);

  assert.equal(
    await failedWorker.processOne(),
    false
  );

  const failedState = await outboxStatus(firstEventId);

  assert.equal(failedState.status, "PENDING");
  assert.equal(failedState.attempts, 1);

  report.failedWorkerRollbackConfirmed = true;
  report.pendingOutboxRetained = true;

  // A failed invalidation must not permit stale reads.
  for (let i = 0; i < 10; i++) {
    await assertMatch(2, 104);
  }

  // Create a fresh worker to simulate recovery.
  const recoveredWorker = makeWorker(redis);

  assert.equal(
    await recoveredWorker.processOne(),
    true
  );

  const completedState =
    await outboxStatus(firstEventId);

  assert.equal(
    completedState.status,
    "COMPLETED"
  );

  report.retryCompleted = true;

  // Cache may be absent following deletion.
  assert.equal(
    await redis.get(cacheKey),
    null
  );

  // An authoritative read should repopulate version 2.
  await assertMatch(2, 104);

  const cachedV2 = JSON.parse(
    await redis.get(cacheKey)
  );

  assert.equal(cachedV2.version, 2);
  assert.equal(cachedV2.runs, 104);

  report.cacheRepaired = true;

  // A duplicate event ID must not generate another
  // durable invalidation record.
  const duplicateInsert = await pool.query(
    `INSERT INTO public.cache_invalidation_outbox
       (event_id, match_id, cache_keys, status)
     VALUES ($1, $2, $3::jsonb, 'PENDING')
     ON CONFLICT (event_id) DO NOTHING`,
    [
      firstEventId,
      matchId,
      JSON.stringify([cacheKey])
    ]
  );

  assert.equal(duplicateInsert.rowCount, 0);

  const countResult = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM public.cache_invalidation_outbox
     WHERE event_id = $1`,
    [firstEventId]
  );

  assert.equal(countResult.rows[0].count, 1);

  report.duplicateOutboxRejected = true;

  // Second committed update after recovery.
  const secondEventId = randomUUID();

  await commitMatchUpdate(
    secondEventId,
    3,
    110
  );

  // Version 2 remains in Redis while invalidation
  // is pending, but must not be served.
  assert.equal(
    JSON.parse(await redis.get(cacheKey)).version,
    2
  );

  for (let i = 0; i < 10; i++) {
    await assertMatch(3, 110);
  }

  assert.equal(
    await recoveredWorker.processOne(),
    true
  );

  assert.equal(
    (await outboxStatus(secondEventId)).status,
    "COMPLETED"
  );

  await assertMatch(3, 110);

  assert.equal(
    JSON.parse(await redis.get(cacheKey)).version,
    3
  );

  report.secondUpdateConsistent = true;
  report.finalVersion = 3;
  report.finalRuns = 110;

  const finalDatabaseRow = await repository.findById(
    matchId
  );

  assert.equal(finalDatabaseRow.version, 3);
  assert.equal(finalDatabaseRow.runs, 110);

  const pending = await pool.query(
    `SELECT COUNT(*)::integer AS count
     FROM public.cache_invalidation_outbox
     WHERE match_id = $1
       AND status <> 'COMPLETED'`,
    [matchId]
  );

  assert.equal(pending.rows[0].count, 0);

  report.passed = [
    report.isolated,
    report.authoritativeDatabasePreserved,
    report.staleCacheNeverServed,
    report.failedWorkerRollbackConfirmed,
    report.pendingOutboxRetained,
    report.retryCompleted,
    report.cacheRepaired,
    report.duplicateOutboxRejected,
    report.secondUpdateConsistent
  ].every(Boolean);
}

try {
  await main();

} catch (error) {
  report.failures.push(
    error.stack ?? String(error)
  );

} finally {
  if (redis.isOpen) {
    redis.destroy();
  }

  try {
    await pool.query(
      "DROP TABLE IF EXISTS resilience_consistency_matches"
    );
  } catch (error) {
    report.failures.push(
      `Cleanup failed: ${error.message}`
    );
  }

  try {
    await pool.end();
  } catch (error) {
    report.failures.push(
      `Pool cleanup: ${error.message}`
    );
  }

  if (report.failures.length > 0) {
    report.passed = false;
  }

  await mkdir(
    path.dirname(OUTPUT),
    { recursive: true }
  );

  await writeFile(
    OUTPUT,
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log(
    JSON.stringify(report, null, 2)
  );

  if (!report.passed) {
    process.exitCode = 1;
  }
}

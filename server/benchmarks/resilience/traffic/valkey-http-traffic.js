
/**
 * Phase 25.7.5.1
 * Continuous HTTP match reads during a Valkey outage.
 * Uses real CricZone controller, service, cache and outbox worker.
 * Restricted to an isolated GitHub Actions environment.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import express from "express";
import pg from "pg";
import { createClient } from "redis";

import MatchService from "../../../src/services/MatchService.js";
import MatchController from "../../../src/controllers/MatchController.js";
import RedisCache from "../../../src/cache/RedisCache.js";
import { CacheKeys } from "../../../src/cache/CacheKeys.js";
import PostgresCacheInvalidationRepository from "../../../src/repositories/postgres/PostgresCacheInvalidationRepository.js";
import CacheInvalidationWorker from "../../../src/workers/CacheInvalidationWorker.js";

const DB_URL =
  "postgresql://criczone_test:criczone_test_password@127.0.0.1:5432/criczone_resilience";

const REDIS_URL = "redis://127.0.0.1:56379";
const CONTAINER = "criczone-traffic-valkey";
const IMAGE = "valkey/valkey:8-alpine";

const OUTPUT = path.resolve(
  "benchmarks/resilience/traffic/reports/valkey-http.json"
);

const runId = randomUUID();
const matchId = Math.floor(900000000 + Math.random() * 90000000);
const cacheKey = CacheKeys.matchById(matchId);

const warnings = [];

const logger = {
  info() {},
  warn(message) { warnings.push(message); },
  error(message) { warnings.push(message); }
};

const report = {
  phase: "25.7.5.1",
  scenario: "continuous_http_match_reads_during_valkey_outage",
  runId,
  matchId,

  isolated: false,
  outageConfirmed: false,
  postgresFallbackUsed: false,
  invalidationCommitted: false,
  workerRepairedCache: false,
  sameRedisClientRecovered: false,

  traffic: {},
  warnings,
  failures: [],
  passed: false
};

function docker(...args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 20000
  }).trim();
}

function verifyIsolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.TEST_DATABASE_URL, DB_URL);
  assert.equal(process.env.REDIS_URL, REDIS_URL);
  assert.equal(process.env.TEST_REDIS_URL, REDIS_URL);

  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(process.env.KAFKA_BROKERS, undefined);

  assert.equal(
    docker("inspect", "--format", "{{.Config.Image}}", CONTAINER),
    IMAGE
  );

  const ports = JSON.parse(
    docker(
      "inspect",
      "--format",
      "{{json .NetworkSettings.Ports}}",
      CONTAINER
    )
  );

  assert(
    ports["6379/tcp"]?.some(
      p => p.HostIp === "127.0.0.1" &&
           p.HostPort === "56379"
    )
  );

  report.isolated = true;
}

async function waitFor(check, label, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(100);
  }

  throw new Error(`${label} timed out`);
}

function summary(records) {
  const timings = records
    .map(x => x.latencyMs)
    .sort((a, b) => a - b);

  return {
    requests: records.length,
    successes: records.filter(
      x => x.status === 200 && x.correctVersion
    ).length,
    failures: records.filter(
      x => x.status !== 200 || !x.correctVersion
    ).length,
    p95Ms: timings.length
      ? timings[Math.ceil(timings.length * 0.95) - 1]
      : null,
    maxMs: timings.at(-1) ?? null
  };
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: false,
  max: 6,
  connectionTimeoutMillis: 1500,
  idleTimeoutMillis: 1000,
  statement_timeout: 3000
});

pool.on("error", error => {
  warnings.push(`PostgreSQL idle connection: ${error.message}`);
});

const redis = createClient({
  url: REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 1500,
    reconnectStrategy: () => 200
  }
});

redis.on("error", () => {});

const cache = new RedisCache(redis, logger);

let pgReads = 0;

const repository = {
  async findById(id) {
    pgReads++;

    const result = await pool.query(
      "SELECT payload FROM resilience_traffic_matches WHERE id = $1",
      [id]
    );

    return result.rows[0]?.payload ?? null;
  }
};

const service = new MatchService(
  repository,
  cache,
  new PostgresCacheInvalidationRepository(pool)
);

const controller = new MatchController(service);

const app = express();

app.get(
  "/api/v1/matches/:matchId",
  controller.getMatchById
);

app.use((error, req, res, next) => {
  void next;

  res.status(503).json({
    success: false,
    error: error.message
  });
});

const server = createServer(app);

let base;
let valkeyStopped = false;
let interval;
let phase = "setup";
let expectedVersion = 1;
let inFlight = 0;

const requests = [];
const records = {
  baseline: [],
  outage: [],
  recovery: []
};

function sendRequest(label, version) {
  inFlight++;

  const task = (async () => {
    const started = performance.now();

    let status = 0;
    let correctVersion = false;

    try {
      const response = await fetch(
        `${base}/api/v1/matches/${matchId}`,
        { signal: AbortSignal.timeout(3000) }
      );

      status = response.status;

      const body = await response.json();

      correctVersion =
        body?.data?.version === version &&
        body?.data?.id === matchId;

    } catch (error) {
      warnings.push(`HTTP request error: ${error.message}`);

    } finally {
      if (records[label]) {
        records[label].push({
          status,
          correctVersion,
          latencyMs: Math.round(
            performance.now() - started
          )
        });
      }

      inFlight--;
    }
  })();

  requests.push(task);
}

try {
  verifyIsolation();

  await pool.query("SELECT 1");

  await pool.query(`
    CREATE TABLE resilience_traffic_matches (
      id BIGINT PRIMARY KEY,
      payload JSONB NOT NULL
    )
  `);

  await pool.query(
    `INSERT INTO resilience_traffic_matches
     (id, payload) VALUES ($1, $2::jsonb)`,
    [
      matchId,
      JSON.stringify({
        id: matchId,
        version: 1,
        runs: 100
      })
    ]
  );

  await redis.connect();

  assert.equal(await redis.ping(), "PONG");

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  base = `http://127.0.0.1:${server.address().port}`;

  // Warm the cache.
  assert.equal(
    (await service.getMatchById(matchId)).version,
    1
  );

  assert.equal(
    JSON.parse(await redis.get(cacheKey)).version,
    1
  );

  // Continuous HTTP traffic starts here.
  phase = "baseline";

  interval = setInterval(() => {
    if (inFlight < 4) {
      sendRequest(phase, expectedVersion);
    }
  }, 60);

  await sleep(1600);

  // Stop Valkey without stopping HTTP traffic.
  phase = "transition";

  valkeyStopped = true;

  docker("stop", "--time", "1", CONTAINER);

  await waitFor(
    () => !redis.isReady,
    "Valkey outage detection"
  );

  report.outageConfirmed = true;

  const readsBeforeOutage = pgReads;

  // Update PostgreSQL and register cache invalidation
  // atomically, just as the outbox design requires.
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE resilience_traffic_matches
       SET payload = $2::jsonb
       WHERE id = $1`,
      [
        matchId,
        JSON.stringify({
          id: matchId,
          version: 2,
          runs: 104
        })
      ]
    );

    await client.query(
      `INSERT INTO public.cache_invalidation_outbox
       (event_id, match_id, cache_keys, status)
       VALUES ($1, $2, $3::jsonb, 'PENDING')`,
      [
        runId,
        matchId,
        JSON.stringify([cacheKey])
      ]
    );

    await client.query("COMMIT");

    report.invalidationCommitted = true;

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }

  expectedVersion = 2;
  phase = "outage";

  await sleep(1800);

  report.postgresFallbackUsed =
    pgReads > readsBeforeOutage;

  // Restart Valkey while requests continue.
  phase = "transition";

  docker("start", CONTAINER);

  valkeyStopped = false;

  await waitFor(
    () => redis.isReady,
    "Valkey client reconnection",
    20000
  );

  assert.equal(await redis.ping(), "PONG");

  report.sameRedisClientRecovered = true;

  // Repair stale cache using the actual outbox worker.
  const worker = new CacheInvalidationWorker(
    {
      getClient: () => pool.connect(),
      query: (...args) => pool.query(...args)
    },
    redis,
    logger
  );

  assert.equal(await worker.processOne(), true);

  const status = await pool.query(
    `SELECT status
     FROM public.cache_invalidation_outbox
     WHERE event_id = $1`,
    [runId]
  );

  assert.equal(
    status.rows[0]?.status,
    "COMPLETED"
  );

  const repairedValue = await redis.get(cacheKey);

  // Another HTTP request may already have repopulated
  // the cache with the new version.
  report.workerRepairedCache =
    repairedValue === null ||
    JSON.parse(repairedValue).version === 2;

  assert.equal(report.workerRepairedCache, true);

  // Verify sustained traffic after recovery.
  phase = "recovery";

  await sleep(1600);

  clearInterval(interval);
  interval = null;

  await Promise.allSettled(requests);

  for (const label of [
    "baseline",
    "outage",
    "recovery"
  ]) {
    report.traffic[label] = summary(records[label]);

    assert(
      report.traffic[label].requests >= 10,
      `Insufficient ${label} traffic`
    );

    assert.equal(
      report.traffic[label].failures,
      0,
      `${label} had failed or stale HTTP responses`
    );
  }

  assert.equal(report.postgresFallbackUsed, true);

  report.passed = [
    report.isolated,
    report.outageConfirmed,
    report.invalidationCommitted,
    report.workerRepairedCache,
    report.sameRedisClientRecovered
  ].every(Boolean);

} catch (error) {
  report.failures.push(error.stack || String(error));

} finally {
  if (interval) {
    clearInterval(interval);
  }

  await Promise.allSettled(requests);

  for (const label of [
    "baseline",
    "outage",
    "recovery"
  ]) {
    report.traffic[label] = summary(records[label]);
  }

  if (valkeyStopped) {
    try {
      docker("start", CONTAINER);
    } catch (error) {
      report.failures.push(
        `Valkey restore: ${error.message}`
      );
    }
  }

  await new Promise(resolve => server.close(resolve));

  if (redis.isOpen) {
    redis.destroy();
  }

  try {
    await pool.query(
      "DROP TABLE IF EXISTS resilience_traffic_matches"
    );
  } catch (error) {
    warnings.push(
      `Test-table cleanup: ${error.message}`
    );
  }

  await pool.end();

  if (report.failures.length) {
    report.passed = false;
  }

  await mkdir(path.dirname(OUTPUT), {
    recursive: true
  });

  await writeFile(
    OUTPUT,
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) {
    process.exitCode = 1;
  }
}

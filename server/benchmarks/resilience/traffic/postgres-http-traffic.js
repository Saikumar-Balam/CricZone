
/**
 * Phase 25.7.5.2
 * Continuous HTTP traffic during PostgreSQL failure.
 * Isolated CI only. No production infrastructure.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { performance } from "node:perf_hooks";
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
  "postgresql://criczone_test:criczone_test_password@127.0.0.1:55432/criczone_resilience";

const REDIS_URL = "redis://127.0.0.1:56379";

const PG_CONTAINER = "criczone-traffic-postgres";
const REDIS_CONTAINER = "criczone-traffic-valkey";

const OUTPUT = path.resolve(
  "benchmarks/resilience/traffic/reports/postgres-http.json"
);

const runId = randomUUID();
const matchId = 950000000 + Math.floor(Math.random() * 40000000);
const cacheKey = CacheKeys.matchById(matchId);

const records = {
  baseline: [],
  outage: [],
  recovery: [],
  transition: []
};

const report = {
  phase: "25.7.5.2",
  scenario: "continuous_http_match_reads_during_postgres_outage",
  runId,
  matchId,
  isolated: false,
  baselineCached: false,
  postgresStopped: false,
  outageDetected: false,
  failClosedDuringOutage: false,
  postgresRestarted: false,
  originalPoolRecovered: false,
  staleCacheBypassed: false,
  outboxRepairedCache: false,
  recoveryHealthy: false,
  traffic: {},
  warnings: [
    "This exercises real CricZone service components in a minimal HTTP host, not the complete production middleware.",
    "Database-dependent requests return 503 during the outage.",
    "AWS ECS infrastructure and load balancing are not tested."
  ],
  failures: [],
  passed: false
};

function docker(...args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 20000
  }).trim();
}

function verifyContainer(name, image, containerPort, hostPort) {
  assert.equal(
    docker("inspect", "--format", "{{.Config.Image}}", name),
    image
  );

  const ports = JSON.parse(
    docker(
      "inspect",
      "--format",
      "{{json .NetworkSettings.Ports}}",
      name
    )
  );

  assert(
    ports[`${containerPort}/tcp`]?.some(
      p =>
        p.HostIp === "127.0.0.1" &&
        p.HostPort === String(hostPort)
    ),
    `Unexpected Docker port mapping for ${name}`
  );
}

function assertIsolated() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.TEST_DATABASE_URL, DB_URL);
  assert.equal(process.env.TEST_REDIS_URL, REDIS_URL);

  assert.equal(process.env.DATABASE_URL, undefined);
  assert.equal(process.env.REDIS_URL, undefined);
  assert.equal(process.env.KAFKA_BROKERS, undefined);

  verifyContainer(
    PG_CONTAINER,
    "postgres:16-alpine",
    5432,
    55432
  );

  verifyContainer(
    REDIS_CONTAINER,
    "valkey/valkey:8-alpine",
    6379,
    56379
  );

  report.isolated = true;
}

async function waitFor(check, label, timeoutMs = 30000) {
  const until = Date.now() + timeoutMs;

  while (Date.now() < until) {
    if (await check()) return;

    await sleep(150);
  }

  throw new Error(`Timed out: ${label}`);
}

function summarize(phase) {
  const rows = records[phase];

  const times = rows
    .map(x => x.latencyMs)
    .sort((a, b) => a - b);

  return {
    requests: rows.length,
    expectedResponses: rows.filter(x => x.correct).length,
    unexpectedResponses: rows.filter(x => !x.correct).length,
    status200: rows.filter(x => x.status === 200).length,
    status503: rows.filter(x => x.status === 503).length,
    timeoutsOrErrors: rows.filter(x => x.status === 0).length,
    p95Ms: times.length
      ? times[Math.ceil(times.length * 0.95) - 1]
      : null,
    maxMs: times.at(-1) ?? null
  };
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: false,
  max: 5,
  connectionTimeoutMillis: 900,
  idleTimeoutMillis: 1000,
  statement_timeout: 2500
});

pool.on("error", error => {
  report.warnings.push(
    `PostgreSQL idle client: ${error.message}`
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
  report.warnings.push(
    `Redis test client: ${error.message}`
  );
});

const logger = {
  info() {},
  warn(message) {
    report.warnings.push(message);
  },
  error(message) {
    report.warnings.push(message);
  }
};

const cache = new RedisCache(redis, logger);

const repository = {
  async findById(id) {
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

// Benchmark-only HTTP error mapping.
app.use((error, req, res, next) => {
  void error;
  void req;
  void next;

  res.status(503).json({
    success: false,
    error: "Database temporarily unavailable"
  });
});

const server = createServer(app);

let base;
let listening = false;
let postgresStopped = false;
let interval;
let phase = "transition";
let inFlight = 0;

const pending = [];

function sendRequest(phaseAtStart) {
  inFlight++;

  const operation = (async () => {
    const start = performance.now();

    let status = 0;
    let version = null;
    let markedFailure = false;

    try {
      const res = await fetch(
        `${base}/api/v1/matches/${matchId}`,
        {
          signal: AbortSignal.timeout(4000)
        }
      );

      status = res.status;

      const body = await res.json();

      version = body?.data?.version ?? null;
      markedFailure = body?.success === false;

    } catch (error) {
      report.warnings.push(
        `HTTP client error: ${error.message}`
      );

    } finally {
      const correct =
        phaseAtStart === "baseline"
          ? status === 200 && version === 1
          : phaseAtStart === "outage"
            ? status === 503 && markedFailure
            : phaseAtStart === "recovery"
              ? status === 200 && version === 2
              : true;

      records[phaseAtStart].push({
        status,
        version,
        correct,
        latencyMs: Math.round(
          performance.now() - start
        )
      });

      inFlight--;
    }
  })();

  pending.push(operation);
}

try {
  assertIsolated();

  await pool.query("SELECT 1");

  await redis.connect();

  assert.equal(await redis.ping(), "PONG");

  // Disposable PostgreSQL test table.
  await pool.query(`
    CREATE TABLE resilience_traffic_matches (
      id BIGINT PRIMARY KEY,
      payload JSONB NOT NULL
    )
  `);

  await pool.query(
    `INSERT INTO resilience_traffic_matches
     (id, payload)
     VALUES ($1, $2::jsonb)`,
    [
      matchId,
      JSON.stringify({
        id: matchId,
        version: 1,
        runs: 100
      })
    ]
  );

  // Create the actual CricZone cache-invalidation outbox.
  const migration = await readFile(
    "database/migrations/001_create_cache_invalidation_outbox.sql",
    "utf8"
  );

  await pool.query(migration);

  await new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(
      0,
      "127.0.0.1",
      resolve
    );
  });

  listening = true;

  base = `http://127.0.0.1:${server.address().port}`;

  // Initial state: PostgreSQL and Redis healthy.
  assert.equal(
    (await service.getMatchById(matchId)).version,
    1
  );

  report.baselineCached =
    JSON.parse(await redis.get(cacheKey)).version === 1;

  assert.equal(report.baselineCached, true);

  // Start continuous HTTP requests.
  phase = "baseline";

  interval = setInterval(() => {
    if (inFlight < 3) {
      sendRequest(phase);
    }
  }, 70);

  await sleep(1800);

  // Transition samples are recorded but excluded
  // from steady-state pass/fail thresholds.
  phase = "transition";

  await sleep(200);

  // Update match data and persist the invalidation
  // atomically before stopping PostgreSQL.
  const db = await pool.connect();

  try {
    await db.query("BEGIN");

    await db.query(
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

    await db.query(
      `INSERT INTO public.cache_invalidation_outbox
       (event_id, match_id, cache_keys, status)
       VALUES ($1, $2, $3::jsonb, 'PENDING')`,
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

  } finally {
    db.release();
  }

  // Simulate complete PostgreSQL outage.
  postgresStopped = true;

  docker(
    "stop",
    "--time",
    "1",
    PG_CONTAINER
  );

  report.postgresStopped =
    docker(
      "inspect",
      "--format",
      "{{.State.Running}}",
      PG_CONTAINER
    ) === "false";

  assert.equal(report.postgresStopped, true);

  await waitFor(
    async () => {
      try {
        await pool.query("SELECT 1");
        return false;
      } catch {
        return true;
      }
    },
    "database outage detection"
  );

  report.outageDetected = true;

  // Requests must fail closed, not serve stale cache.
  phase = "outage";

  await sleep(1900);

  phase = "transition";

  // Restart the original PostgreSQL container.
  docker("start", PG_CONTAINER);

  postgresStopped = false;

  await waitFor(
    async () => {
      try {
        await pool.query("SELECT 1");
        return true;
      } catch {
        return false;
      }
    },
    "original PostgreSQL pool recovery"
  );

  report.postgresRestarted = true;
  report.originalPoolRecovered = true;

  // Redis still contains version 1.
  assert.equal(
    JSON.parse(await redis.get(cacheKey)).version,
    1
  );

  // Pending outbox must force a PostgreSQL read.
  const authoritative =
    await service.getMatchById(matchId);

  report.staleCacheBypassed =
    authoritative.version === 2;

  assert.equal(
    report.staleCacheBypassed,
    true
  );

  // Process the real cache-invalidation outbox.
  const worker = new CacheInvalidationWorker(
    {
      getClient: () => pool.connect(),
      query: (...args) => pool.query(...args)
    },
    redis,
    logger
  );

  assert.equal(
    await worker.processOne(),
    true
  );

  const outbox = await pool.query(
    `SELECT status
     FROM public.cache_invalidation_outbox
     WHERE event_id = $1`,
    [runId]
  );

  assert.equal(
    outbox.rows[0]?.status,
    "COMPLETED"
  );

  const currentCache =
    await redis.get(cacheKey);

  report.outboxRepairedCache =
    currentCache === null ||
    JSON.parse(currentCache).version === 2;

  assert.equal(
    report.outboxRepairedCache,
    true
  );

  // HTTP traffic after PostgreSQL recovery.
  phase = "recovery";

  await sleep(1800);

  clearInterval(interval);
  interval = null;

  await Promise.allSettled(pending);

  for (const p of [
    "baseline",
    "outage",
    "recovery"
  ]) {
    report.traffic[p] = summarize(p);

    assert(
      report.traffic[p].requests >= 10,
      `Too few ${p} samples`
    );

    assert.equal(
      report.traffic[p].unexpectedResponses,
      0,
      `Unexpected or stale responses during ${p}`
    );
  }

  report.traffic.transition =
    summarize("transition");

  report.failClosedDuringOutage =
    report.traffic.outage.status503 ===
    report.traffic.outage.requests;

  report.recoveryHealthy =
    report.traffic.recovery.status200 ===
    report.traffic.recovery.requests;

  report.passed = [
    report.isolated,
    report.baselineCached,
    report.postgresStopped,
    report.outageDetected,
    report.failClosedDuringOutage,
    report.postgresRestarted,
    report.originalPoolRecovered,
    report.staleCacheBypassed,
    report.outboxRepairedCache,
    report.recoveryHealthy
  ].every(Boolean);

} catch (error) {
  report.failures.push(
    error.stack ?? String(error)
  );

} finally {
  if (interval) {
    clearInterval(interval);
  }

  await Promise.allSettled(pending);

  for (const p of [
    "baseline",
    "outage",
    "recovery",
    "transition"
  ]) {
    report.traffic[p] = summarize(p);
  }

  if (postgresStopped) {
    try {
      docker("start", PG_CONTAINER);
    } catch (error) {
      report.failures.push(
        `Postgres restore: ${error.message}`
      );
    }
  }

  if (listening) {
    await new Promise(resolve => {
      server.close(resolve);
    });
  }

  if (redis.isOpen) {
    redis.destroy();
  }

  try {
    await pool.end();
  } catch (error) {
    report.warnings.push(
      `Pool cleanup: ${error.message}`
    );
  }

  if (report.failures.length) {
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

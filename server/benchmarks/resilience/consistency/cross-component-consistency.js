
/**
 * CricZone Phase 25.7.6.4
 * Connected Kafka -> PostgreSQL -> Valkey -> Socket.IO -> REST test.
 *
 * Uses isolated infrastructure and test-specific scoring adapters.
 * Does not claim production-wide exactly-once processing.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import express from "express";
import pg from "pg";
import { createClient } from "redis";
import { Kafka, logLevel } from "kafkajs";
import { io } from "socket.io-client";

import KafkaEventConsumer from "../../../src/messaging/KafkaEventConsumer.js";
import KafkaEventProducer from "../../../src/messaging/KafkaEventProducer.js";
import RedisEventIdempotencyStore from "../../../src/messaging/RedisEventIdempotencyStore.js";
import KafkaConsumerRetryStrategy from "../../../src/messaging/KafkaConsumerRetryStrategy.js";
import KafkaDeadLetterPublisher from "../../../src/messaging/KafkaDeadLetterPublisher.js";
import { createEvent } from "../../../src/messaging/EventFactory.js";
import MatchService from "../../../src/services/MatchService.js";
import MatchController from "../../../src/controllers/MatchController.js";
import { createMatchRouter } from "../../../src/routes/match.routes.js";
import { CacheKeys } from "../../../src/cache/CacheKeys.js";
import RedisCache from "../../../src/cache/RedisCache.js";

const PG_URL =
  "postgresql://criczone_test:criczone_test_password@127.0.0.1:55436/criczone_resilience";
const REDIS_URL = "redis://127.0.0.1:56384";
const BROKER = "127.0.0.1:9092";
const WS_URL = "http://127.0.0.1:4009";
const API_URL = "http://127.0.0.1:4010";

const OUTPUT = path.resolve(
  "benchmarks/resilience/consistency/reports/cross-component.json"
);

const runId = randomUUID();
const suffix = runId.replaceAll("-", "");
const matchId = String(980000000 + Math.floor(Math.random() * 10000000));
const topic = `criczone.cross-consistency.${suffix}`;
const dlqTopic = `${topic}.dlq`;
const groupId = `criczone-cross-${suffix}`;
const key = CacheKeys.matchById(matchId);

const report = {
  phase: "25.7.6.4",
  scenario: "connected_cross_component_recovery_consistency",
  runId,
  isolated: false,
  kafkaProcessed: false,
  duplicateEventIdSkipped: false,
  duplicateDeliveryRejected: false,
  postgresAuthoritative: false,
  staleRedisBypassed: false,
  pendingInvalidationRetained: false,
  cacheRepaired: false,
  websocketMissedDuringDisconnect: false,
  restResynchronizationSucceeded: false,
  newLiveEventDelivered: false,
  staleWebsocketEventRejected: false,
  finalComponentsConsistent: false,
  publishedEvents: 0,
  successfulMessages: 0,
  duplicateEventSkips: 0,
  duplicateDeliveryRejections: 0,
  uniqueDeliveries: 0,
  missedEvents: 0,
  staleEventsIgnored: 0,
  finalScore: null,
  failures: [],
  warnings: [
    "Integration uses a test-specific PostgreSQL delivery ledger, not the complete production cricket schema.",
    "The existing CricZone Kafka consumer, producer, MatchService, MatchController, RedisCache and Socket.IO benchmark server are exercised.",
    "The test adapter publishes versioned score snapshots; production BALL_RECORDED payload versioning is not established.",
    "Client REST resynchronization is implemented in this benchmark, not verified in the production frontend.",
    "The cache invalidation worker is simulated by an explicit delete/complete operation; this does not independently verify the production worker.",
    "No broker crash, offset rewind, AWS failover, or exactly-once delivery guarantee is tested."
  ],
  passed: false
};

function isolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.TEST_DATABASE_URL, PG_URL);
  assert.equal(process.env.TEST_REDIS_URL, REDIS_URL);
  assert.equal(process.env.TEST_KAFKA_BROKER, BROKER);
  assert.equal(process.env.WS_BENCH_PORT, "4009");
  assert.equal(process.env.WS_BENCH_REDIS_URL, REDIS_URL);
  for (const variable of ["DATABASE_URL", "REDIS_URL", "KAFKA_BROKERS"]) {
    assert.equal(process.env[variable], undefined);
  }
  report.isolated = true;
}

const logger = {
  info() {},
  debug() {},
  warn() {},
  error(message, details) {
    console.error(message, details ?? "");
  }
};

const pool = new pg.Pool({
  connectionString: PG_URL,
  ssl: false,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000
});

const redis = createClient({
  url: REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 3000,
    reconnectStrategy: false
  }
});

const kafka = new Kafka({
  clientId: `criczone-cross-${suffix}`,
  brokers: [BROKER],
  logLevel: logLevel.NOTHING,
  connectionTimeout: 3000,
  requestTimeout: 5000
});

const admin = kafka.admin();
const rawProducer = kafka.producer({
  allowAutoTopicCreation: false
});

const producer = new KafkaEventProducer(rawProducer, logger);
const deadLetterPublisher = new KafkaDeadLetterPublisher(producer, {
  topic: dlqTopic
});

const cache = new RedisCache(redis, logger);

let successfulMessages = 0;
let duplicateEventSkips = 0;
let duplicateDeliveryRejections = 0;
let consumer = null;
let apiServer = null;
let wsProcess = null;
let deferredCache = false;
let staleEventsIgnored = 0;
let missedEvents = 0;
let socketClient = null;

const metrics = {
  incrementCounter(name, count = 1) {
    if (name === "kafka_events_consumed_total") successfulMessages += count;
    if (name === "kafka_duplicate_events_total") duplicateEventSkips += count;
    if (name === "kafka_dead_letter_events_total") {
      report.failures.push("Unexpected Kafka dead-letter event");
    }
    if (name === "kafka_event_failures_total") {
      report.failures.push("Unexpected Kafka processing failure");
    }
  },
  observeHistogram() {}
};

async function waitFor(check, label, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    if (report.failures.length) throw new Error(report.failures.join("; "));
    await sleep(50);
  }
  throw new Error(`Timed out: ${label}`);
}

async function snapshot() {
  const result = await pool.query(
    `SELECT id, version, runs, wickets
     FROM cross_matches WHERE id = $1`,
    [matchId]
  );
  assert.equal(result.rowCount, 1);
  const row = result.rows[0];
  return {
    matchId: String(row.id),
    version: Number(row.version),
    runs: Number(row.runs),
    wickets: Number(row.wickets)
  };
}

async function httpJson(base, endpoint, body) {
  const response = await fetch(`${base}${endpoint}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(3000)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function getRest() {
  const response = await httpJson(
    API_URL,
    `/api/v1/matches/${matchId}`
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  return response.body.data;
}

async function roomCount() {
  const response = await httpJson(
    WS_URL,
    `/rooms?matchId=${encodeURIComponent(matchId)}`
  );
  assert.equal(response.status, 200);
  return response.body.members;
}

async function emitScore(state, eventId = randomUUID()) {
  const response = await httpJson(WS_URL, "/emit", {
    matchId,
    eventId,
    payload: state
  });
  assert.equal(response.status, 200);
}

async function recordBall(event) {
  const { deliveryId, runs, wicket } = event.payload ?? {};

  assert.equal(event.type, "BALL_RECORDED");
  assert.equal(String(event.aggregateId), matchId);
  assert.equal(typeof deliveryId, "string");
  assert(Number.isSafeInteger(runs) && runs >= 0);
  assert(wicket === 0 || wicket === 1);

  const client = await pool.connect();
  let inserted = false;

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO cross_deliveries
         (match_id, delivery_id, event_id, runs, wicket)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (match_id, delivery_id) DO NOTHING
       RETURNING delivery_id`,
      [matchId, deliveryId, event.eventId, runs, wicket]
    );

    inserted = result.rowCount === 1;

    if (inserted) {
      await client.query(
        `UPDATE cross_matches
         SET version = version + 1,
             runs = runs + $2,
             wickets = wickets + $3
         WHERE id = $1`,
        [matchId, runs, wicket]
      );

      await client.query(
        `INSERT INTO cross_pending_invalidation (match_id)
         VALUES ($1)
         ON CONFLICT (match_id)
         DO UPDATE SET pending = TRUE`,
        [matchId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (!inserted) {
    duplicateDeliveryRejections++;
    return;
  }

  const state = await snapshot();

  if (!deferredCache) {
    await repairCache();
  }

  // The benchmark server invokes CricZone's SocketIOGateway.
  await emitScore(state, event.eventId);
}

async function repairCache() {
  const state = await snapshot();

  // Simulated completion of cache invalidation.
  await redis.del(key);

  await pool.query(
    `UPDATE cross_pending_invalidation
     SET pending = FALSE
     WHERE match_id = $1`,
    [matchId]
  );

  await cache.set(key, state, 120);

  assert.deepEqual(await cache.get(key), state);
}

async function createApi() {
  const repository = {
    async findById(id) {
      if (String(id) !== matchId) return null;
      return snapshot();
    }
  };

  const invalidationRepository = {
    async hasPendingInvalidation(id) {
      const result = await pool.query(
        `SELECT pending
         FROM cross_pending_invalidation
         WHERE match_id = $1`,
        [id]
      );
      return result.rows[0]?.pending ?? false;
    }
  };

  const service = new MatchService(
    repository,
    cache,
    invalidationRepository
  );

  const controller = new MatchController(service);
  const validation = {
    handle(req, res, next) {
      if (!/^\d+$/.test(req.params.matchId)) {
        return res.status(400).json({ success: false });
      }
      next();
    }
  };

  const app = express();

  app.use(
    "/api/v1/matches",
    createMatchRouter(
      controller,
      validation,
      {
        getScorecardByMatchId(req, res) {
          res.status(501).json({ error: "Not tested" });
        }
      }
    )
  );

  app.use((error, req, res, next) => {
    console.error("REST integration error:", error);
    res.status(500).json({ success: false });
  });

  apiServer = createServer(app);

  await new Promise((resolve, reject) => {
    apiServer.once("error", reject);
    apiServer.listen(4010, "127.0.0.1", resolve);
  });
}

async function startWebsocket() {
  wsProcess = spawn(
    process.execPath,
    ["benchmarks/resilience/websocket/websocket-server.js"],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  wsProcess.stdout.on("data", data => {
    process.stdout.write(`[ws] ${data}`);
  });
  wsProcess.stderr.on("data", data => {
    process.stderr.write(`[ws] ${data}`);
  });
  wsProcess.on("error", error => {
    report.failures.push(`WebSocket spawn: ${error.message}`);
  });

  await waitFor(async () => {
    try {
      return (await httpJson(WS_URL, "/health")).body.ok === true;
    } catch {
      return false;
    }
  }, "WebSocket readiness");
}

function viewer() {
  const socket = io(WS_URL, {
    transports: ["websocket"],
    reconnection: false,
    autoConnect: false,
    forceNew: true
  });

  const view = {
    socket,
    state: null,
    received: [],
    apply(value, source) {
      if (!value || value.matchId !== matchId) return;

      if (this.state && value.version <= this.state.version) {
        if (source === "socket") staleEventsIgnored++;
        return;
      }

      if (
        source === "socket" &&
        this.state &&
        value.version > this.state.version + 1
      ) {
        missedEvents += value.version - this.state.version - 1;
        return;
      }

      this.state = {
        matchId: value.matchId,
        version: value.version,
        runs: value.runs,
        wickets: value.wickets
      };
    }
  };

  socket.on("BALL_RECORDED", value => {
    view.received.push(value);
    view.apply(value, "socket");
  });

  return view;
}

async function connectViewer(view) {
  view.socket.connect();
  await waitFor(() => view.socket.connected, "client connection");
  view.socket.emit("join-match", matchId);
  await waitFor(async () => (await roomCount()) === 1, "room join");
}

async function disconnectViewer(view) {
  view.socket.disconnect();
  await waitFor(
    async () => (await roomCount()) === 0,
    "room departure"
  );
}

function ball(deliveryId, runs, wicket = 0) {
  return createEvent({
    type: "BALL_RECORDED",
    aggregateId: matchId,
    payload: { deliveryId, runs, wicket }
  });
}

async function publish(event) {
  await producer.publish(topic, event);
  report.publishedEvents++;
}

async function waitConsumed(expected) {
  await waitFor(
    () => successfulMessages + duplicateEventSkips >= expected,
    `${expected} Kafka records processed`
  );
}

async function main() {
  isolation();
  await pool.query("SELECT 1");
  await redis.connect();
  assert.equal(await redis.ping(), "PONG");

  await pool.query(`
    CREATE TABLE cross_matches (
      id BIGINT PRIMARY KEY,
      version INTEGER NOT NULL,
      runs INTEGER NOT NULL,
      wickets INTEGER NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE cross_deliveries (
      match_id BIGINT NOT NULL,
      delivery_id TEXT NOT NULL,
      event_id UUID NOT NULL,
      runs INTEGER NOT NULL,
      wicket INTEGER NOT NULL,
      PRIMARY KEY (match_id, delivery_id)
    )
  `);

  await pool.query(`
    CREATE TABLE cross_pending_invalidation (
      match_id BIGINT PRIMARY KEY,
      pending BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);

  await pool.query(
    `INSERT INTO cross_matches
       (id, version, runs, wickets)
     VALUES ($1, 1, 10, 1)`,
    [matchId]
  );

  await pool.query(
    `INSERT INTO cross_pending_invalidation
       (match_id, pending)
     VALUES ($1, FALSE)`,
    [matchId]
  );

  await cache.set(key, await snapshot(), 120);

  await createApi();
  await startWebsocket();

  const initialViewer = viewer();
  socketClient = initialViewer;
  await connectViewer(initialViewer);

  initialViewer.apply(await getRest(), "rest");

  await admin.connect();
  await admin.createTopics({
    waitForLeaders: true,
    topics: [topic, dlqTopic].map(topicName => ({
      topic: topicName,
      numPartitions: 1,
      replicationFactor: 1
    }))
  });
  await rawProducer.connect();

  const rawConsumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: false
  });

  // Isolated test topic: consume from the beginning.
  const originalSubscribe = rawConsumer.subscribe.bind(rawConsumer);
  rawConsumer.subscribe = options =>
    originalSubscribe({ ...options, fromBeginning: true });

  consumer = new KafkaEventConsumer(
    rawConsumer,
    logger,
    metrics,
    new KafkaConsumerRetryStrategy({ maxRetries: 0 }),
    new RedisEventIdempotencyStore(redis, {
      keyPrefix: `test:criczone:cross:${suffix}:`,
      ttlSeconds: 600
    }),
    deadLetterPublisher
  );

  const A = ball("A", 4);
  const alternateA = ball("A", 4);
  const B = ball("B", 6);
  const C = ball("C", 2);

  // Publish baseline messages before the initial group starts.
  await publish(A);
  await publish(A);
  await publish(alternateA);

  await consumer.connect();
  await consumer.subscribe(topic, recordBall);

  await waitConsumed(3);

  await waitFor(
    () => initialViewer.state?.version === 2,
    "baseline score delivery"
  );

  assert.deepEqual(initialViewer.state, {
    matchId, version: 2, runs: 14, wickets: 1
  });

  assert.equal(duplicateEventSkips, 1);
  assert.equal(duplicateDeliveryRejections, 1);

  report.kafkaProcessed = true;
  report.duplicateEventIdSkipped = true;
  report.duplicateDeliveryRejected = true;

  // Client will miss the next update.
  await disconnectViewer(initialViewer);
  const countBefore = initialViewer.received.length;

  // Force the cache to remain stale after PostgreSQL commits.
  deferredCache = true;
  await publish(B);
  await waitConsumed(4);

  const authoritative = await snapshot();
  assert.deepEqual(authoritative, {
    matchId, version: 3, runs: 20, wickets: 1
  });

  assert.equal(
    initialViewer.received.length,
    countBefore
  );

  report.websocketMissedDuringDisconnect = true;
  report.postgresAuthoritative = true;
  report.missedEvents = 1;

  // Redis still contains version 2.
  const staleCache = await cache.get(key);
  assert.equal(staleCache.version, 2);

  const pending = await pool.query(
    `SELECT pending FROM cross_pending_invalidation
     WHERE match_id = $1`,
    [matchId]
  );
  assert.equal(pending.rows[0].pending, true);
  report.pendingInvalidationRetained = true;

  // MatchService bypasses stale cache while invalidation is pending.
  assert.deepEqual(await getRest(), authoritative);
  assert.equal((await cache.get(key)).version, 2);
  report.staleRedisBypassed = true;

  // Complete simulated cache repair.
  await repairCache();
  deferredCache = false;
  assert.deepEqual(await cache.get(key), authoritative);
  report.cacheRepaired = true;

  // Reconnect with a fresh Socket.IO client.
  const recoveredViewer = viewer();
  socketClient = recoveredViewer;
  await connectViewer(recoveredViewer);
  recoveredViewer.apply(await getRest(), "rest");
  assert.deepEqual(recoveredViewer.state, authoritative);
  report.restResynchronizationSucceeded = true;

  // New legitimate ball after recovery.
  await publish(C);
  await waitConsumed(5);

  await waitFor(
    () => recoveredViewer.state?.version === 4,
    "post-recovery live delivery"
  );

  assert.deepEqual(recoveredViewer.state, {
    matchId, version: 4, runs: 22, wickets: 1
  });
  report.newLiveEventDelivered = true;

  // Deliver an older snapshot without changing PostgreSQL.
  const receivedBeforeStale = recoveredViewer.received.length;
  await emitScore({
    matchId, version: 2, runs: 14, wickets: 1
  }, `stale-${runId}`);

  await waitFor(
    () => recoveredViewer.received.length > receivedBeforeStale,
    "stale event observation"
  );

  assert.equal(recoveredViewer.state.version, 4);
  assert(staleEventsIgnored >= 1);
  report.staleWebsocketEventRejected = true;

  const finalDb = await snapshot();
  const finalRedis = await cache.get(key);
  const finalRest = await getRest();

  const ledger = await pool.query(
    `SELECT COUNT(*)::integer AS count,
            COALESCE(SUM(runs), 0)::integer AS added_runs,
            COALESCE(SUM(wicket), 0)::integer AS added_wickets
     FROM cross_deliveries
     WHERE match_id = $1`,
    [matchId]
  );

  assert.equal(ledger.rows[0].count, 3);
  assert.equal(ledger.rows[0].added_runs, 12);
  assert.equal(ledger.rows[0].added_wickets, 0);

  for (const value of [
    finalRedis,
    finalRest,
    recoveredViewer.state
  ]) {
    assert.deepEqual(value, finalDb);
  }

  assert.deepEqual(finalDb, {
    matchId, version: 4, runs: 22, wickets: 1
  });

  report.uniqueDeliveries = 3;
  report.finalScore = finalDb;
  report.finalComponentsConsistent = true;

  assert.equal(report.publishedEvents, 5);
  assert.equal(successfulMessages, 4);
  assert.equal(duplicateEventSkips, 1);
  assert.equal(duplicateDeliveryRejections, 1);

  report.successfulMessages = successfulMessages;
  report.duplicateEventSkips = duplicateEventSkips;
  report.duplicateDeliveryRejections =
    duplicateDeliveryRejections;
  report.staleEventsIgnored = staleEventsIgnored;
  report.missedEvents = 1;

  report.passed = [
    report.isolated,
    report.kafkaProcessed,
    report.duplicateEventIdSkipped,
    report.duplicateDeliveryRejected,
    report.postgresAuthoritative,
    report.staleRedisBypassed,
    report.pendingInvalidationRetained,
    report.cacheRepaired,
    report.websocketMissedDuringDisconnect,
    report.restResynchronizationSucceeded,
    report.newLiveEventDelivered,
    report.staleWebsocketEventRejected,
    report.finalComponentsConsistent
  ].every(Boolean);
}

try {
  await main();
} catch (error) {
  report.failures.push(error.stack ?? String(error));
} finally {
  socketClient?.socket.disconnect();

  const cleanup = await Promise.allSettled([
    consumer?.disconnect() ?? Promise.resolve(),
    rawProducer.disconnect(),
    admin.disconnect()
  ]);

  for (const result of cleanup) {
    if (result.status === "rejected") {
      report.failures.push(
        `Messaging cleanup: ${result.reason?.message ?? result.reason}`
      );
    }
  }

  if (wsProcess) {
    const child = wsProcess;
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await Promise.race([
        new Promise(resolve => child.once("exit", resolve)),
        sleep(3000)
      ]);
    }
  }

  if (apiServer) {
    apiServer.closeAllConnections();
    await new Promise(resolve => apiServer.close(resolve));
  }

  if (redis.isOpen) {
    await redis.quit().catch(error => {
      report.failures.push(`Redis cleanup: ${error.message}`);
    });
  }

  await pool.end().catch(error => {
    report.failures.push(`PostgreSQL cleanup: ${error.message}`);
  });

  report.successfulMessages = successfulMessages;
  report.duplicateEventSkips = duplicateEventSkips;
  report.duplicateDeliveryRejections =
    duplicateDeliveryRejections;
  report.staleEventsIgnored = staleEventsIgnored;

  if (report.failures.length) report.passed = false;

  await mkdir(path.dirname(OUTPUT), {
    recursive: true
  });

  await writeFile(
    OUTPUT,
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) process.exitCode = 1;
}


/**
 * CricZone Phase 25.7.6.2
 * Kafka duplicate event and replay consistency.
 *
 * Real KafkaJS, PostgreSQL, Valkey and CricZone consumer.
 * Only runs against isolated GitHub Actions services.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

import { Kafka, logLevel } from "kafkajs";
import pg from "pg";
import { createClient } from "redis";

import KafkaEventConsumer from "../../../src/messaging/KafkaEventConsumer.js";
import KafkaEventProducer from "../../../src/messaging/KafkaEventProducer.js";
import RedisEventIdempotencyStore from "../../../src/messaging/RedisEventIdempotencyStore.js";
import KafkaConsumerRetryStrategy from "../../../src/messaging/KafkaConsumerRetryStrategy.js";
import KafkaDeadLetterPublisher from "../../../src/messaging/KafkaDeadLetterPublisher.js";
import { createEvent } from "../../../src/messaging/EventFactory.js";

const DB_URL =
  "postgresql://criczone_test:criczone_test_password@127.0.0.1:55434/criczone_resilience";

const REDIS_URL = "redis://127.0.0.1:56382";
const BROKER = "127.0.0.1:9092";

const OUTPUT = path.resolve(
  "benchmarks/resilience/consistency/reports/kafka-replay.json"
);

const runId = randomUUID();
const suffix = runId.replaceAll("-", "");
const matchId = 960000000 + Math.floor(Math.random() * 10000000);

const topic = `criczone.consistency.${suffix}`;
const dlqTopic = `criczone.consistency.dlq.${suffix}`;

const report = {
  phase: "25.7.6.2",
  scenario: "kafka_duplicate_event_replay_consistency",
  runId,

  isolated: false,
  originalEventsApplied: false,
  duplicateEventIdsSkipped: false,
  duplicateDeliveryIdsRejected: false,
  consumerRestarted: false,
  replayDidNotDoubleScore: false,
  newEventAfterRestartApplied: false,
  authoritativeScoreVerified: false,
  noUnexpectedDeadLetters: false,

  publishedEvents: 0,
  handlerInvocations: 0,
  uniqueDeliveries: 0,
  redisDuplicateSkips: 0,
  postgresDuplicateRejections: 0,

  finalRuns: null,
  finalWickets: null,

  failures: [],
  warnings: [
    "Replay is simulated by republishing event envelopes with their original event IDs.",
    "This does not test Kafka offset rewind or broker crash recovery.",
    "Redis event claims expire and are not atomic with PostgreSQL commits.",
    "Database uniqueness protects the isolated test ledger, not yet every production scoring path.",
    "Exactly-once business processing is not established."
  ],
  passed: false
};

function verifyIsolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.TEST_DATABASE_URL, DB_URL);
  assert.equal(process.env.TEST_REDIS_URL, REDIS_URL);
  assert.equal(process.env.TEST_KAFKA_BROKER, BROKER);

  for (const name of [
    "DATABASE_URL",
    "REDIS_URL",
    "KAFKA_BROKERS"
  ]) {
    assert.equal(
      process.env[name],
      undefined,
      `${name} must not point to production`
    );
  }

  report.isolated = true;
}

const logger = {
  info() {},
  warn() {},
  error(message, details) {
    console.error(message, details ?? "");
  }
};

const metrics = {
  incrementCounter(name, amount = 1) {
    if (name === "kafka_duplicate_events_total") {
      report.redisDuplicateSkips += amount;
    }

    if (name === "kafka_dead_letter_events_total") {
      report.failures.push(
        "Unexpected event was sent to the dead-letter topic"
      );
    }
  },
  observeHistogram() {}
};

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: false,
  max: 5,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000
});

pool.on("error", error => {
  report.failures.push(
    `PostgreSQL pool error: ${error.message}`
  );
});

const redis = createClient({
  url: REDIS_URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 3000,
    reconnectStrategy: false
  }
});

redis.on("error", error => {
  report.failures.push(
    `Valkey connection error: ${error.message}`
  );
});

const kafka = new Kafka({
  clientId: `criczone-consistency-${suffix}`,
  brokers: [BROKER],
  logLevel: logLevel.NOTHING,
  connectionTimeout: 3000,
  requestTimeout: 5000,
  retry: {
    retries: 3
  }
});

const admin = kafka.admin();
const rawProducer = kafka.producer({
  allowAutoTopicCreation: false
});

const eventProducer =
  new KafkaEventProducer(rawProducer, logger);

const deadLetterPublisher =
  new KafkaDeadLetterPublisher(eventProducer, {
    topic: dlqTopic
  });

let activeConsumer = null;
let handlerInvocations = 0;
let appliedDeliveries = 0;
let duplicateDeliveryRejections = 0;

async function waitFor(check, label, timeout = 20000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await check()) return;

    await sleep(100);
  }

  throw new Error(`Timed out: ${label}`);
}

async function getScore() {
  const result = await pool.query(
    `SELECT runs, wickets
     FROM resilience_kafka_matches
     WHERE id = $1`,
    [matchId]
  );

  assert.equal(result.rowCount, 1);

  return result.rows[0];
}

async function getDeliveries() {
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS count,
            COALESCE(SUM(runs), 0)::integer AS runs,
            COALESCE(SUM(wicket), 0)::integer AS wickets
     FROM resilience_kafka_deliveries
     WHERE match_id = $1`,
    [matchId]
  );

  return result.rows[0];
}

async function applyBall(event) {
  assert.equal(event.type, "BALL_RECORDED");
  assert.equal(String(event.aggregateId), String(matchId));

  const {
    deliveryId,
    runs,
    wicket
  } = event.payload ?? {};

  assert.equal(typeof deliveryId, "string");
  assert(deliveryId.length > 0);
  assert(Number.isSafeInteger(runs) && runs >= 0);
  assert(wicket === 0 || wicket === 1);

  handlerInvocations++;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Delivery ID is the business identity of a ball.
    // It is independent of Kafka's event ID.
    const inserted = await client.query(
      `INSERT INTO resilience_kafka_deliveries
         (match_id, delivery_id, event_id, runs, wicket)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (delivery_id) DO NOTHING
       RETURNING delivery_id`,
      [
        matchId,
        deliveryId,
        event.eventId,
        runs,
        wicket
      ]
    );

    if (inserted.rowCount === 1) {
      const updated = await client.query(
        `UPDATE resilience_kafka_matches
         SET runs = runs + $2,
             wickets = wickets + $3
         WHERE id = $1`,
        [matchId, runs, wicket]
      );

      assert.equal(updated.rowCount, 1);

      appliedDeliveries++;
    } else {
      duplicateDeliveryRejections++;
    }

    await client.query("COMMIT");

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve original failure.
    }

    throw error;

  } finally {
    client.release();
  }
}


async function startConsumer(label) {
  assert.equal(
    activeConsumer,
    null,
    "Previous consumer must stop before restart"
  );

  // Preserve the SAME consumer group across restarts.
  // This is important for Kafka offset continuity.
  const groupId = `criczone-consistency-${suffix}`;

  const rawConsumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: false,
    sessionTimeout: 10000,
    heartbeatInterval: 1000
  });

  let joined = false;
  let fetchStarted = false;

  rawConsumer.on(
    rawConsumer.events.GROUP_JOIN,
    () => {
      joined = true;
      console.log(
        `[${label}] Kafka consumer joined group`
      );
    }
  );

  rawConsumer.on(
    rawConsumer.events.FETCH_START,
    () => {
      fetchStarted = true;
    }
  );

  const store = new RedisEventIdempotencyStore(
    redis,
    {
      keyPrefix:
        `test:criczone:consistency:${suffix}:`,
      ttlSeconds: 600
    }
  );

  const wrapper = new KafkaEventConsumer(
    rawConsumer,
    logger,
    metrics,
    new KafkaConsumerRetryStrategy({
      maxRetries: 0
    }),
    store,
    deadLetterPublisher
  );

  activeConsumer = wrapper;

  await wrapper.connect();

  await wrapper.subscribe(
    topic,
    applyBall
  );

  // A group join alone is not enough.
  // Wait until KafkaJS begins its fetch cycle.
  await waitFor(
    () => joined && fetchStarted,
    `${label} Kafka consumer fetch readiness`,
    30000
  );

  console.log(
    `[${label}] Consumer ready for event processing`
  );
}


async function stopConsumer() {
  if (!activeConsumer) return;

  const consumer = activeConsumer;
  activeConsumer = null;

  await consumer.disconnect();
}

function ball(deliveryId, runs, wicket = 0) {
  return createEvent({
    type: "BALL_RECORDED",
    aggregateId: String(matchId),
    payload: {
      deliveryId,
      runs,
      wicket
    }
  });
}

async function publish(event) {
  await eventProducer.publish(topic, event);
  report.publishedEvents++;
}

async function verifyScore(
  expectedRuns,
  expectedWickets,
  expectedDeliveries
) {
  const score = await getScore();
  const deliveries = await getDeliveries();

  assert.equal(score.runs, expectedRuns);
  assert.equal(score.wickets, expectedWickets);

  assert.equal(deliveries.count, expectedDeliveries);
  assert.equal(deliveries.runs, expectedRuns);
  assert.equal(deliveries.wickets, expectedWickets);
}


async function waitForHandled(expected) {
  try {
    await waitFor(
      () =>
        handlerInvocations +
          report.redisDuplicateSkips >= expected,
      `${expected} consumed Kafka messages`,
      30000
    );
  } catch (error) {
    console.error("Kafka replay diagnostics:", {
      expectedMessages: expected,
      publishedEvents: report.publishedEvents,
      handlerInvocations,
      redisDuplicateSkips:
        report.redisDuplicateSkips,
      postgresDuplicateRejections:
        duplicateDeliveryRejections,
      accountedMessages:
        handlerInvocations +
        report.redisDuplicateSkips
    });

    throw error;
  }
}


async function main() {
  verifyIsolation();

  await pool.query("SELECT 1");

  await redis.connect();
  assert.equal(await redis.ping(), "PONG");

  // These tables exist only inside the isolated CI database.
  await pool.query(`
    CREATE TABLE resilience_kafka_matches (
      id BIGINT PRIMARY KEY,
      runs INTEGER NOT NULL DEFAULT 0,
      wickets INTEGER NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE resilience_kafka_deliveries (
      delivery_id TEXT PRIMARY KEY,
      match_id BIGINT NOT NULL
        REFERENCES resilience_kafka_matches(id),
      event_id UUID NOT NULL,
      runs INTEGER NOT NULL,
      wicket INTEGER NOT NULL
    )
  `);

  await pool.query(
    `INSERT INTO resilience_kafka_matches
       (id, runs, wickets)
     VALUES ($1, 0, 0)`,
    [matchId]
  );

  await admin.connect();

  await admin.createTopics({
    waitForLeaders: true,
    topics: [
      {
        topic,
        numPartitions: 1,
        replicationFactor: 1
      },
      {
        topic: dlqTopic,
        numPartitions: 1,
        replicationFactor: 1
      }
    ]
  });

  await rawProducer.connect();

  const ballA = ball("delivery-A", 4);
  const ballB = ball("delivery-B", 6, 1);

  // First consumer processes the baseline events.
  await startConsumer("initial");

  await publish(ballA);
  await publish(ballA);

  // Different event ID, same ball identity.
  const ballAAlternate = ball("delivery-A", 4);
  await publish(ballAAlternate);

  await publish(ballB);

 await waitForHandled(4);

await waitFor(async () => {
  const score = await getScore();
  const deliveries = await getDeliveries();

  return (
    score.runs === 10 &&
    score.wickets === 1 &&
    deliveries.count === 2
  );
}, "baseline database reconciliation");

await verifyScore(10, 1, 2);

  report.originalEventsApplied = true;

  assert(report.redisDuplicateSkips >= 1);

  report.duplicateEventIdsSkipped = true;

  assert(duplicateDeliveryRejections >= 1);

  report.duplicateDeliveryIdsRejected = true;

  // Stop the original Kafka consumer.
  await stopConsumer();

  // Start a new consumer instance with the same
  // Redis idempotency namespace.
  await startConsumer("restarted");

  report.consumerRestarted = true;

  // Replay original event envelopes.
  await publish(ballA);
  await publish(ballB);

  // Different event ID but already scored delivery.
  const ballBAlternate = ball("delivery-B", 6, 1);
  await publish(ballBAlternate);

  // Legitimate new ball after restart.
  const ballC = ball("delivery-C", 2);
  await publish(ballC);
  await publish(ballC);

  await waitForHandled(9);

await waitFor(async () => {
  const score = await getScore();
  const deliveries = await getDeliveries();

  return (
    score.runs === 12 &&
    score.wickets === 1 &&
    deliveries.count === 3
  );
}, "replayed database reconciliation");

await verifyScore(12, 1, 3);

  report.replayDidNotDoubleScore = true;
  report.newEventAfterRestartApplied = true;

  assert(report.redisDuplicateSkips >= 4);
  assert(duplicateDeliveryRejections >= 2);

  // Reconcile authoritative match score against
  // the unique committed delivery ledger.
  const score = await getScore();
  const deliveries = await getDeliveries();

  assert.equal(score.runs, deliveries.runs);
  assert.equal(score.wickets, deliveries.wickets);

  report.authoritativeScoreVerified = true;

  report.handlerInvocations = handlerInvocations;
  report.postgresDuplicateRejections =
    duplicateDeliveryRejections;
  report.uniqueDeliveries = deliveries.count;

  report.finalRuns = score.runs;
  report.finalWickets = score.wickets;

  report.noUnexpectedDeadLetters =
    report.failures.length === 0;

  assert.equal(appliedDeliveries, 3);
  assert.equal(report.publishedEvents, 9);
  assert.equal(report.handlerInvocations, 5);

  report.passed = [
    report.isolated,
    report.originalEventsApplied,
    report.duplicateEventIdsSkipped,
    report.duplicateDeliveryIdsRejected,
    report.consumerRestarted,
    report.replayDidNotDoubleScore,
    report.newEventAfterRestartApplied,
    report.authoritativeScoreVerified,
    report.noUnexpectedDeadLetters
  ].every(Boolean);
}

try {
  await main();

} catch (error) {
  report.failures.push(
    error.stack ?? String(error)
  );

} finally {
  try {
    await stopConsumer();
  } catch (error) {
    report.failures.push(
      `Consumer cleanup: ${error.message}`
    );
  }

  await Promise.allSettled([
    rawProducer.disconnect(),
    admin.disconnect()
  ]);

  if (redis.isOpen) {
    redis.destroy();
  }

  try {
    await pool.end();
  } catch (error) {
    report.failures.push(
      `PostgreSQL cleanup: ${error.message}`
    );
  }

  report.handlerInvocations = handlerInvocations;
  report.postgresDuplicateRejections =
    duplicateDeliveryRejections;

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

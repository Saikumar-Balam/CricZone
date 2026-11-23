
/**
 * CricZone Phase 25.7.6.2: Kafka duplicate-event and replay consistency.
 * Real KafkaJS, PostgreSQL, Valkey, and CricZone messaging adapters.
 * Run only in isolated GitHub Actions test infrastructure.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
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

const matchId =
  960000000 + Math.floor(Math.random() * 10000000);

const topic = `criczone.consistency.${suffix}`;
const dlqTopic = `criczone.consistency.dlq.${suffix}`;
const groupId = `criczone-consistency-${suffix}`;

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
    "Replay means republishing original event envelopes; Kafka offset rewind is not tested.",
    "This does not test Kafka broker crashes or recovery.",
    "Redis event claims expire and are not atomic with PostgreSQL commits.",
    "Database uniqueness protects the isolated test ledger, not all production scoring paths.",
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

  for (const variable of [
    "DATABASE_URL",
    "REDIS_URL",
    "KAFKA_BROKERS"
  ]) {
    assert.equal(
      process.env[variable],
      undefined,
      `${variable} must not be set`
    );
  }

  report.isolated = true;
}

const logger = {
  info() {},

  warn(message, details) {
    console.warn(message, details ?? "");
  },

  error(message, details) {
    console.error(message, details ?? "");
  }
};

let successfulMessages = 0;
let deadLetterEvents = 0;

const metrics = {
  incrementCounter(name, amount = 1) {
    if (name === "kafka_events_consumed_total") {
      successfulMessages += amount;
    }

    if (name === "kafka_duplicate_events_total") {
      report.redisDuplicateSkips += amount;
    }

    if (name === "kafka_dead_letter_events_total") {
      deadLetterEvents += amount;

      report.failures.push(
        "Unexpected Kafka event sent to dead-letter topic"
      );
    }

    if (name === "kafka_event_failures_total") {
      report.failures.push(
        "Unexpected Kafka consumer event failure"
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
    `PostgreSQL pool: ${error.message}`
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
    `Valkey: ${error.message}`
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

async function waitFor(
  predicate,
  label,
  timeoutMs = 30000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    if (report.failures.length) {
      throw new Error(
        `Unexpected failure during ${label}: ${report.failures.join("; ")}`
      );
    }

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
    `SELECT
       COUNT(*)::integer AS count,
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

  assert.equal(
    String(event.aggregateId),
    String(matchId)
  );

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
  let inserted = false;

  try {
    await client.query("BEGIN");

    const result = await client.query(
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

    inserted = result.rowCount === 1;

    if (inserted) {
      const updated = await client.query(
        `UPDATE resilience_kafka_matches
         SET runs = runs + $2,
             wickets = wickets + $3
         WHERE id = $1`,
        [matchId, runs, wicket]
      );

      assert.equal(updated.rowCount, 1);
    }

    await client.query("COMMIT");

    // Count only successfully committed transactions.
    if (inserted) {
      appliedDeliveries++;
    } else {
      duplicateDeliveryRejections++;
    }

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve original error.
    }

    throw error;

  } finally {
    client.release();
  }
}

function makeBall(
  deliveryId,
  runs,
  wicket = 0
) {
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

async function startConsumer(label) {
  assert.equal(activeConsumer, null);

  const rawConsumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: false,
    sessionTimeout: 10000,
    heartbeatInterval: 1000
  });

  /*
   * Only for this isolated benchmark:
   *
   * The production KafkaEventConsumer adapter uses
   * fromBeginning: false.
   *
   * For the initial test consumer, override that
   * subscription option so a new consumer group starts
   * at offset 0, where the baseline events already exist.
   *
   * Do not change production consumer behavior.
   */
  if (label === "initial") {
    const subscribe =
      rawConsumer.subscribe.bind(rawConsumer);

    rawConsumer.subscribe = options =>
      subscribe({
        ...options,
        fromBeginning: true
      });
  }

  let joined = false;

  rawConsumer.on(
    rawConsumer.events.GROUP_JOIN,
    () => {
      joined = true;

      console.log(
        `[${label}] Kafka consumer joined group`
      );
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

  try {
    await wrapper.connect();

    await wrapper.subscribe(
      topic,
      applyBall
    );

    await waitFor(
      () => joined,
      `${label} Kafka consumer group join`
    );

  } catch (error) {
    try {
      await wrapper.disconnect();
    } catch {
      // Preserve original failure.
    }

    activeConsumer = null;

    throw error;
  }

  console.log(
    `[${label}] Consumer joined; awaiting completed-message metrics`
  );
}

async function stopConsumer() {
  if (!activeConsumer) {
    return;
  }

  const consumer = activeConsumer;

  activeConsumer = null;

  await consumer.disconnect();
}

function logDiagnostics(expected) {
  console.error("Kafka replay diagnostics:", {
    expected,
    publishedEvents: report.publishedEvents,
    successfulMessages,
    redisDuplicateSkips:
      report.redisDuplicateSkips,

    accountedMessages:
      successfulMessages +
      report.redisDuplicateSkips,

    handlerInvocations,
    appliedDeliveries,

    postgresDuplicateRejections:
      duplicateDeliveryRejections,

    deadLetterEvents
  });
}

async function waitForProcessed(expected) {
  try {
    await waitFor(
      () =>
        successfulMessages +
          report.redisDuplicateSkips >= expected,

      `${expected} processed/skipped Kafka records`
    );

  } catch (error) {
    logDiagnostics(expected);

    throw error;
  }
}

async function waitForGroupOffset(expected) {
  /*
   * Verify that the same consumer group committed
   * the Kafka offsets before restarting.
   */
  await waitFor(async () => {
    const records = await admin.fetchOffsets({
      groupId,
      topics: [topic]
    });

    const partition = records
      .find(record => record.topic === topic)
      ?.partitions
      .find(item => item.partition === 0);

    return partition &&
      BigInt(partition.offset) >= BigInt(expected);

  }, `committed consumer group offset ${expected}`);
}

async function verifyScore(
  runs,
  wickets,
  deliveries
) {
  const score = await getScore();
  const ledger = await getDeliveries();

  assert.deepEqual(score, {
    runs,
    wickets
  });

  assert.deepEqual(ledger, {
    count: deliveries,
    runs,
    wickets
  });
}

async function main() {
  verifyIsolation();

  await pool.query("SELECT 1");

  await redis.connect();

  assert.equal(
    await redis.ping(),
    "PONG"
  );

  /*
   * Test-only PostgreSQL tables.
   */
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

  /*
   * Create isolated Kafka topics.
   */
  await admin.connect();

  await admin.createTopics({
    waitForLeaders: true,

    topics: [
      topic,
      dlqTopic
    ].map(name => ({
      topic: name,
      numPartitions: 1,
      replicationFactor: 1
    }))
  });

  await rawProducer.connect();

  /*
   * Baseline:
   *
   * Ball A: 4 runs
   * Ball B: 6 runs, 1 wicket
   *
   * Expected: 10 runs, 1 wicket
   */
  const ballA = makeBall(
    "delivery-A",
    4
  );

  const ballB = makeBall(
    "delivery-B",
    6,
    1
  );

  const alternateA = makeBall(
    "delivery-A",
    4
  );

  /*
   * Publish baseline records BEFORE creating the
   * initial consumer.
   *
   * This eliminates the initial offset race.
   */
  for (const event of [
    ballA,
    ballA,
    alternateA,
    ballB
  ]) {
    await publish(event);
  }

  /*
   * Confirm Kafka contains exactly four records.
   */
  const initialOffsets =
    await admin.fetchTopicOffsets(topic);

  assert.equal(initialOffsets.length, 1);

  assert.equal(
    initialOffsets[0].offset,
    "4"
  );

  /*
   * Start consumer from the beginning of the
   * isolated topic.
   */
  await startConsumer("initial");

  await waitForProcessed(4);

  await verifyScore(
    10,
    1,
    2
  );

  assert.equal(successfulMessages, 3);
  assert.equal(report.redisDuplicateSkips, 1);
  assert.equal(duplicateDeliveryRejections, 1);

  report.originalEventsApplied = true;
  report.duplicateEventIdsSkipped = true;
  report.duplicateDeliveryIdsRejected = true;

  /*
   * Confirm offset 4 is committed before stopping
   * the consumer.
   */
  await waitForGroupOffset(4);

  await stopConsumer();

  /*
   * Restart using the same Kafka consumer group and
   * Redis idempotency namespace.
   */
  await startConsumer("restarted");

  report.consumerRestarted = true;

  /*
   * Replay previous event envelopes.
   */
  const alternateB = makeBall(
    "delivery-B",
    6,
    1
  );

  const ballC = makeBall(
    "delivery-C",
    2
  );

  /*
   * Replay:
   *
   * A original event ID: Redis skip
   * B original event ID: Redis skip
   * B alternate ID: PostgreSQL duplicate
   * C original: 2 runs
   * C duplicate: Redis skip
   */
  for (const event of [
    ballA,
    ballB,
    alternateB,
    ballC,
    ballC
  ]) {
    await publish(event);
  }

  await waitForProcessed(9);

  /*
   * Expected final score:
   *
   * 4 + 6 + 2 = 12 runs
   * 1 wicket
   * 3 unique deliveries
   */
  await verifyScore(
    12,
    1,
    3
  );

  await waitForGroupOffset(9);

  /*
   * Verify exact event accounting.
   */
  assert.equal(successfulMessages, 5);

  assert.equal(report.redisDuplicateSkips, 4);

  assert.equal(duplicateDeliveryRejections, 2);

  assert.equal(appliedDeliveries, 3);

  assert.equal(handlerInvocations, 5);

  assert.equal(report.publishedEvents, 9);

  report.replayDidNotDoubleScore = true;
  report.newEventAfterRestartApplied = true;
  report.authoritativeScoreVerified = true;

  report.noUnexpectedDeadLetters =
    deadLetterEvents === 0 &&
    report.failures.length === 0;

  report.uniqueDeliveries =
    (await getDeliveries()).count;

  const finalScore = await getScore();

  report.finalRuns = finalScore.runs;
  report.finalWickets = finalScore.wickets;

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

  /*
   * Release all isolated infrastructure connections.
   */
  const cleanup = await Promise.allSettled([
    rawProducer.disconnect(),
    admin.disconnect(),

    redis.isOpen
      ? redis.quit()
      : Promise.resolve(),

    pool.end()
  ]);

  for (const outcome of cleanup) {
    if (outcome.status === "rejected") {
      report.failures.push(
        `Cleanup: ${outcome.reason?.message ?? outcome.reason}`
      );
    }
  }

  report.handlerInvocations =
    handlerInvocations;

  report.postgresDuplicateRejections =
    duplicateDeliveryRejections;

  if (report.failures.length) {
    report.passed = false;
  }

  await mkdir(
    path.dirname(OUTPUT),
    {
      recursive: true
    }
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

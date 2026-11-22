import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Kafka } from "kafkajs";
import { createClient } from "redis";

import KafkaEventConsumer from "../../../src/messaging/KafkaEventConsumer.js";
import RedisEventIdempotencyStore from "../../../src/messaging/RedisEventIdempotencyStore.js";
import LiveBallEventHandler from "../../../src/messaging/handlers/LiveBallEventHandler.js";
import { createEvent } from "../../../src/messaging/EventFactory.js";

const BROKER = "127.0.0.1:9092";
const REDIS_URL = "redis://127.0.0.1:56379";

const runId = randomUUID();
const topic = `criczone.replay.${runId.replaceAll("-", "")}`;
const groupId = `criczone-replay-${runId}`;

const output = path.resolve(
  "benchmarks/resilience/kafka/reports/idempotency.json"
);

const report = {
  phase: "25.7.3.7",
  runId,
  scenario: "kafka_consumer_restart_and_duplicate_replay",

  firstEventProcessed: false,
  consumerRestarted: false,
  duplicateReplayObserved: false,
  duplicateHandlerSkipped: false,
  freshEventProcessed: false,
  redisClaimSurvivedConsumerRestart: false,

  expectedUniqueEvents: 2,
  handlerInvocations: 0,
  duplicateEventsSkipped: 0,

  durableExactlyOnceProven: false,

  warnings: [
    "Redis idempotency claims expire after their configured TTL.",
    "A crash after claiming but before completing processing can suppress replay.",
    "This benchmark verifies handler invocation, not durable PostgreSQL business side effects."
  ],

  failures: [],
  passed: false
};

function assertIsolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.KAFKA_RESILIENCE_BROKERS, BROKER);
  assert.equal(process.env.TEST_KAFKA_BROKERS, BROKER);
  assert.equal(process.env.TEST_REDIS_URL, REDIS_URL);

  assert.equal(
    process.env.KAFKA_BROKERS,
    undefined,
    "Production Kafka configuration must not be present"
  );

  assert.equal(
    process.env.REDIS_URL,
    undefined,
    "Production Redis configuration must not be present"
  );
}

async function waitFor(predicate, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (predicate()) return;

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function bounded(promise, label, ms = 10000) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          ms
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const logger = {
  info() {},
  warn() {},
  error(...args) {
    console.error(...args);
  }
};

const handledEvents = [];

const liveUpdateService = {
  async processBallRecorded(event) {
    handledEvents.push(event.eventId);
    report.handlerInvocations = handledEvents.length;
  }
};

const handler = new LiveBallEventHandler(
  liveUpdateService,
  logger
);

let redis;
let producer;
let admin;
let activeConsumer;

function createKafka() {
  return new Kafka({
    clientId: `criczone-replay-${runId}`,
    brokers: [BROKER],
    ssl: false,
    connectionTimeout: 3000,
    requestTimeout: 5000,
    retry: {
      initialRetryTime: 200,
      retries: 5,
      maxRetryTime: 1500
    }
  });
}

function makeConsumer(kafka) {
  const nativeConsumer = kafka.consumer({
    groupId,
    sessionTimeout: 10000,
    heartbeatInterval: 2000
  });

  const store = new RedisEventIdempotencyStore(redis, {
    keyPrefix: `criczone:test:replay:${runId}:`,
    ttlSeconds: 3600
  });

  const metrics = {
    incrementCounter(name, count) {
      if (name === "kafka_duplicate_events_total") {
        report.duplicateEventsSkipped += count;
      }
    },
    observeHistogram() {}
  };

  const retryStrategy = {
    async execute(operation) {
      return operation();
    }
  };

  const deadLetterPublisher = {
    async publish() {
      throw new Error("Unexpected dead-letter publication");
    }
  };

  const appConsumer = new KafkaEventConsumer(
    nativeConsumer,
    logger,
    metrics,
    retryStrategy,
    store,
    deadLetterPublisher
  );

  return { nativeConsumer, appConsumer, store };
}

async function startConsumer(kafka) {
  const instance = makeConsumer(kafka);

  let joined = 0;

  instance.nativeConsumer.on(
    instance.nativeConsumer.events.GROUP_JOIN,
    () => {
      joined += 1;
    }
  );

  await bounded(
    instance.appConsumer.connect(),
    "consumer connect"
  );

  await bounded(
    instance.appConsumer.subscribe(topic, handler.handle),
    "consumer subscribe"
  );

  await waitFor(
    () => joined > 0,
    "consumer group assignment",
    30000
  );

  return instance;
}

function makeBallEvent() {
  return createEvent({
    type: "BALL_RECORDED",
    aggregateId: `test-match-${runId}`,
    payload: {
      matchId: 101,
      inningsId: 201,
      inningsNumber: 1,
      overNumber: 1,
      ballNumber: 1,
      strikerId: 301,
      nonStrikerId: 302,
      bowlerId: 401,
      runs: { batsman: 4, extras: 0, total: 4 },
      extras: 0,
      boundary: true,
      wicket: { occurred: false },
      legalDelivery: true
    },
    requestId: runId,
    traceId: randomUUID()
  });
}

async function publish(event) {
  await bounded(
    producer.send({
      topic,
      acks: -1,
      messages: [{
        key: String(event.aggregateId),
        value: JSON.stringify(event)
      }]
    }),
    "Kafka publish"
  );
}

try {
  assertIsolation();

  redis = createClient({
    url: REDIS_URL,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: false
    }
  });

  redis.on("error", error => {
    console.error("Test Redis error:", error.message);
  });

  await bounded(redis.connect(), "Redis connect");

  const kafka = createKafka();

  admin = kafka.admin();
  producer = kafka.producer();

  await bounded(admin.connect(), "Kafka admin connect");

  await bounded(
    admin.createTopics({
      waitForLeaders: true,
      topics: [{
        topic,
        numPartitions: 1,
        replicationFactor: 1
      }]
    }),
    "Kafka topic creation"
  );

  await bounded(producer.connect(), "producer connect");

  // First consumer instance.
  activeConsumer = await startConsumer(kafka);

  const originalEvent = makeBallEvent();

  await publish(originalEvent);

  await waitFor(
    () => handledEvents.includes(originalEvent.eventId),
    "first business handler invocation"
  );

  assert.equal(handledEvents.length, 1);
  report.firstEventProcessed = true;

  // Redis retains the claim when the Kafka consumer stops.
  const claimKey = activeConsumer.store.buildKey(
    originalEvent.eventId
  );

  assert.equal(await redis.exists(claimKey), 1);

  await bounded(
    activeConsumer.appConsumer.disconnect(),
    "first consumer disconnect"
  );

  activeConsumer = null;

  // Create an entirely new Kafka consumer instance.
  activeConsumer = await startConsumer(kafka);

  report.consumerRestarted = true;

  assert.equal(await redis.exists(claimKey), 1);

  report.redisClaimSurvivedConsumerRestart = true;

  // Republish the same event ID after consumer restart.
  await publish(originalEvent);

  await waitFor(
    () => report.duplicateEventsSkipped >= 1,
    "duplicate replay detection"
  );

  report.duplicateReplayObserved = true;

  assert.equal(
    handledEvents.length,
    1,
    "Duplicate event must not invoke the handler again"
  );

  report.duplicateHandlerSkipped = true;

  // A different event must still be processed normally.
  const freshEvent = makeBallEvent();

  await publish(freshEvent);

  await waitFor(
    () => handledEvents.includes(freshEvent.eventId),
    "fresh event processing"
  );

  assert.equal(handledEvents.length, 2);

  assert.equal(
    new Set(handledEvents).size,
    2,
    "Each unique event should invoke the handler once"
  );

  report.freshEventProcessed = true;

  report.passed = [
    report.firstEventProcessed,
    report.consumerRestarted,
    report.duplicateReplayObserved,
    report.duplicateHandlerSkipped,
    report.freshEventProcessed,
    report.redisClaimSurvivedConsumerRestart
  ].every(Boolean);

} catch (error) {
  report.failures.push(error.stack ?? String(error));

} finally {
  if (activeConsumer) {
    try {
      await bounded(
        activeConsumer.appConsumer.disconnect(),
        "consumer cleanup"
      );
    } catch (error) {
      report.warnings.push(error.message);
    }
  }

  if (producer) {
    try {
      await bounded(producer.disconnect(), "producer cleanup");
    } catch (error) {
      report.warnings.push(error.message);
    }
  }

  if (admin) {
    try {
      await bounded(admin.disconnect(), "admin cleanup");
    } catch (error) {
      report.warnings.push(error.message);
    }
  }

  if (redis) {
    try {
      if (redis.isOpen) {
        await bounded(redis.quit(), "Redis cleanup");
      }
    } catch (error) {
      redis.destroy();
      report.warnings.push(error.message);
    }
  }

  if (report.failures.length > 0) {
    report.passed = false;
  }

  await mkdir(path.dirname(output), {
    recursive: true
  });

  await writeFile(
    output,
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) {
    process.exitCode = 1;
  }
}
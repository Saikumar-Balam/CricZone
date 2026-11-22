/**
 * Phase 25.7.3: Kafka broker failure and recovery.
 *
 * Uses an isolated GitHub Actions Kafka broker.
 * Never connects to production Aiven Kafka.
 *
 * Scope: Kafka transport recovery and event ID reconciliation.
 * Does not prove durable exactly-once business processing.
 */

import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Kafka, logLevel } from "kafkajs";

const BROKER = "127.0.0.1:9092";
const CONTAINER = "criczone-kafka-resilience";
const IMAGE = "apache/kafka:3.9.1";

const REPORT_PATH = path.resolve(
  "benchmarks/resilience/kafka/reports/recovery.json"
);

const timeoutMs = 45000;
const runId = randomUUID();

const topic = `criczone.resilience.${runId.replaceAll("-", "")}`;
const groupId = `criczone-resilience-${runId}`;

const report = {
  phase: "25.7.3",
  scenario: "isolated_kafka_broker_restart",
  runId,

  baselineDelivered: false,
  outageDetected: false,
  brokerRestarted: false,
  originalConsumerRecovered: false,
  producerRecovered: false,
  postRecoveryDelivered: false,

  allExpectedEventIdsObserved: false,
  duplicateBusinessHandlersPreventedInMemory: false,

  expectedEventCount: 2,
  uniqueEventCount: 0,
  transportDeliveryCount: 0,

  warnings: [
    "In-memory handler deduplication is test-local; durable business-level exactly-once processing is not proven.",
    "A single local Kafka broker is not a production multi-broker cluster."
  ],

  failures: [],
  passed: false
};

function docker(...args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 15000
  });
}

function assertIsolated() {
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.NODE_ENV !== "test" ||
    process.env.KAFKA_RESILIENCE_BROKERS !== BROKER
  ) {
    throw new Error(
      "Refusing to run outside isolated GitHub Actions test environment"
    );
  }

  if (
    process.env.KAFKA_BROKERS ||
    process.env.TEST_KAFKA_BROKERS?.replace(
      "localhost",
      "127.0.0.1"
    ) !== BROKER
  ) {
    throw new Error(
      "Unexpected Kafka broker configuration; production access forbidden"
    );
  }

  const image = docker(
    "inspect",
    "--format",
    "{{.Config.Image}}",
    CONTAINER
  ).trim();

  if (image !== IMAGE) {
    throw new Error(`Unexpected Kafka image: ${image}`);
  }

  const bindings = JSON.parse(
    docker(
      "inspect",
      "--format",
      "{{json .NetworkSettings.Ports}}",
      CONTAINER
    )
  );

  const mapped = bindings["9092/tcp"];

  if (
    !Array.isArray(mapped) ||
    !mapped.some(
      p =>
        p.HostPort === "9092" &&
        ["127.0.0.1", "0.0.0.0", "::"].includes(p.HostIp)
    )
  ) {
    throw new Error(
      "Expected isolated 9092 port binding is absent"
    );
  }
}

async function deadline(operation, label, ms = timeoutMs) {
  let handle;

  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        handle = setTimeout(
          () => reject(
            new Error(`${label} timed out after ${ms}ms`)
          ),
          ms
        );
      })
    ]);
  } finally {
    clearTimeout(handle);
  }
}

function makeKafka(clientId) {
  return new Kafka({
    clientId,
    brokers: [BROKER],
    ssl: false,
    logLevel: logLevel.ERROR,

    connectionTimeout: 1200,
    authenticationTimeout: 1200,
    requestTimeout: 2500,

    retry: {
      initialRetryTime: 200,
      retries: 2,
      maxRetryTime: 1000
    }
  });
}

function makeEvent(stage) {
  return {
    eventId: randomUUID(),
    type: "BALL_RECORDED",
    aggregateId: `resilience-${runId}`,
    stage,
    testRunId: runId
  };
}

async function publish(producer, event) {
  await deadline(
    producer.send({
      topic,
      acks: -1,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event)
        }
      ]
    }),
    `publish ${event.stage}`
  );
}

async function waitFor(predicate, label, ms = timeoutMs) {
  const end = Date.now() + ms;

  while (Date.now() < end) {
    if (predicate()) {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(
    `${label} did not occur within ${ms}ms`
  );
}

async function waitForBroker() {
  const end = Date.now() + 60000;

  while (Date.now() < end) {
    try {
      docker(
        "exec",
        CONTAINER,
        "/opt/kafka/bin/kafka-broker-api-versions.sh",
        "--bootstrap-server",
        BROKER
      );

      return;
    } catch {
      await new Promise(
        resolve => setTimeout(resolve, 1000)
      );
    }
  }

  throw new Error(
    "Isolated broker did not become ready after restart"
  );
}

let producer;
let consumer;
let admin;

let brokerStopped = false;
let originalGroupJoins = 0;

const seen = new Set();
const accepted = new Set();
const expected = [];

try {
  assertIsolated();

  const kafka = makeKafka(
    `criczone-resilience-${runId}`
  );

  admin = kafka.admin();

  producer = kafka.producer({
    allowAutoTopicCreation: false
  });

  consumer = kafka.consumer({
    groupId,
    allowAutoTopicCreation: false,
    sessionTimeout: 6000,
    heartbeatInterval: 1500
  });

  await deadline(
    admin.connect(),
    "admin connect"
  );

  await deadline(
    admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic,
          numPartitions: 1,
          replicationFactor: 1
        }
      ]
    }),
    "topic creation"
  );

  await deadline(
    producer.connect(),
    "producer connect"
  );

  await deadline(
    consumer.connect(),
    "consumer connect"
  );

  consumer.on(
    consumer.events.GROUP_JOIN,
    () => {
      originalGroupJoins += 1;
    }
  );

  await deadline(
    consumer.subscribe({
      topic,
      fromBeginning: true
    }),
    "consumer subscribe"
  );

  await deadline(
    consumer.run({
      eachMessage: async ({ message }) => {
        const event = JSON.parse(
          message.value.toString("utf8")
        );

        if (event.testRunId !== runId) {
          return;
        }

        report.transportDeliveryCount += 1;

        seen.add(event.eventId);

        if (!accepted.has(event.eventId)) {
          accepted.add(event.eventId);
        }
      }
    }),
    "consumer run"
  );

  await waitFor(
    () => originalGroupJoins >= 1,
    "initial consumer group join"
  );

  // Verify baseline message delivery.
  const before = makeEvent("before-outage");

  expected.push(before.eventId);

  await publish(producer, before);

  await waitFor(
    () => seen.has(before.eventId),
    "baseline event delivery"
  );

  report.baselineDelivered = true;

  // Simulate infrastructure failure.
  docker(
    "stop",
    "--time",
    "1",
    CONTAINER
  );

  brokerStopped = true;

  try {
    await deadline(
      admin.fetchTopicMetadata({
        topics: [topic]
      }),
      "expected outage probe",
      12000
    );

    throw new Error(
      "Kafka metadata request succeeded while isolated broker was stopped"
    );
  } catch (error) {
    if (
      error.message ===
      "Kafka metadata request succeeded while isolated broker was stopped"
    ) {
      throw error;
    }

    report.outageDetected = true;
  }

  // Restart Kafka.
  docker("start", CONTAINER);

  brokerStopped = false;

  await waitForBroker();

  report.brokerRestarted = true;

  // Verify original consumer rejoins.
  await waitFor(
    () => originalGroupJoins >= 2,
    "original Kafka consumer rejoin",
    60000
  );

  report.originalConsumerRecovered = true;

  // Reuse original producer after recovery.
  const after = makeEvent("after-recovery");

  expected.push(after.eventId);

  await publish(producer, after);

  report.producerRecovered = true;

  await waitFor(
    () => seen.has(after.eventId),
    "post-recovery delivery",
    60000
  );

  report.postRecoveryDelivered = true;

  // Reconcile event IDs.
  report.uniqueEventCount = seen.size;

  report.allExpectedEventIdsObserved =
    expected.length === seen.size &&
    expected.every(id => seen.has(id));

  report.duplicateBusinessHandlersPreventedInMemory =
    accepted.size === seen.size &&
    expected.every(id => accepted.has(id));

  report.passed = [
    report.baselineDelivered,
    report.outageDetected,
    report.brokerRestarted,
    report.originalConsumerRecovered,
    report.producerRecovered,
    report.postRecoveryDelivered,
    report.allExpectedEventIdsObserved,
    report.duplicateBusinessHandlersPreventedInMemory
  ].every(Boolean);

} catch (error) {
  report.failures.push(
    error.stack ?? String(error)
  );

} finally {
  if (brokerStopped) {
    try {
      docker("start", CONTAINER);
      await waitForBroker();
    } catch (error) {
      report.failures.push(
        `broker cleanup: ${error.message}`
      );
    }
  }

  for (const [name, client] of [
    ["consumer", consumer],
    ["producer", producer],
    ["admin", admin]
  ]) {
    if (!client) {
      continue;
    }

    try {
      await deadline(
        client.disconnect(),
        `${name} disconnect`,
        10000
      );
    } catch (error) {
      report.warnings.push(
        `${name} disconnect: ${error.message}`
      );
    }
  }

  if (report.failures.length) {
    report.passed = false;
  }

  await mkdir(
    path.dirname(REPORT_PATH),
    { recursive: true }
  );

  await writeFile(
    REPORT_PATH,
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log(
    JSON.stringify(report, null, 2)
  );

  if (!report.passed) {
    process.exitCode = 1;
  }
}
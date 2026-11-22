
/**
 * CricZone Phase 25.7.5.3
 * HTTP traffic during an isolated Kafka broker outage.
 *
 * Uses the application's real KafkaEventProducer.
 * Never connects to production infrastructure.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";
import express from "express";
import { Kafka, logLevel } from "kafkajs";

import KafkaEventProducer from "../../../src/messaging/KafkaEventProducer.js";
import { createEvent } from "../../../src/messaging/EventFactory.js";

const BROKER = "127.0.0.1:9092";
const CONTAINER = "criczone-traffic-kafka";
const IMAGE = "apache/kafka:3.9.1";

const runId = randomUUID();
const topic = `criczone.traffic.${runId.replaceAll("-", "")}`;

const OUTPUT = path.resolve(
  "benchmarks/resilience/traffic/reports/kafka-http.json"
);

const report = {
  phase: "25.7.5.3",
  scenario: "continuous_http_traffic_during_kafka_outage",
  runId,

  isolated: false,
  baselinePublishingSucceeded: false,
  brokerStopped: false,
  publishingFailureDetected: false,
  noFalseAcknowledgements: false,
  brokerRestarted: false,
  originalProducerRecovered: false,
  independentHttpTrafficSurvived: false,
  postRecoveryPublishingSucceeded: false,

  traffic: {},
  warnings: [
    "This tests KafkaEventProducer through an isolated Express HTTP host.",
    "It does not exercise the complete production middleware or AWS ECS deployment.",
    "A failed publish acknowledgement does not prove that Kafka never committed the event.",
    "Durable event replay and exactly-once business effects are outside this benchmark."
  ],
  failures: [],
  passed: false
};

const records = {
  baseline: [],
  outage: [],
  recovery: [],
  transition: []
};

function docker(...args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 20000
  }).trim();
}

function assertIsolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.KAFKA_TRAFFIC_BROKERS, BROKER);

  assert.equal(process.env.KAFKA_BROKERS, undefined);
  assert.equal(process.env.TEST_KAFKA_USERNAME, undefined);
  assert.equal(process.env.KAFKA_USERNAME, undefined);

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
    ports["9092/tcp"]?.some(
      p => p.HostIp === "127.0.0.1" &&
           p.HostPort === "9092"
    ),
    "Expected isolated Kafka port mapping"
  );

  report.isolated = true;
}

async function waitFor(check, label, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(150);
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForBroker() {
  await waitFor(
    () => {
      try {
        execFileSync(
          "docker",
          [
            "exec",
            CONTAINER,
            "/opt/kafka/bin/kafka-broker-api-versions.sh",
            "--bootstrap-server",
            BROKER
          ],
          {
            stdio: "ignore",
            timeout: 5000
          }
        );

        return true;
      } catch {
        return false;
      }
    },
    "Kafka broker readiness",
    60000
  );
}

function summarize(phase) {
  const rows = records[phase];

  const latencies = rows
    .map(x => x.latencyMs)
    .sort((a, b) => a - b);

  return {
    requests: rows.length,
    successes: rows.filter(x => x.status === 200).length,
    unavailable: rows.filter(x => x.status === 503).length,
    clientErrors: rows.filter(x => x.status === 0).length,
    p95Ms: latencies.length
      ? latencies[Math.ceil(latencies.length * 0.95) - 1]
      : null,
    maxMs: latencies.at(-1) ?? null
  };
}

const kafka = new Kafka({
  clientId: `criczone-traffic-${runId}`,
  brokers: [BROKER],
  ssl: false,
  logLevel: logLevel.ERROR,
  connectionTimeout: 1000,
  requestTimeout: 2000,
  retry: {
    initialRetryTime: 200,
    retries: 1,
    maxRetryTime: 500
  }
});

const nativeProducer = kafka.producer({
  allowAutoTopicCreation: false
});

const admin = kafka.admin();

const logger = {
  info() {},
  warn() {},
  error(message, details) {
    console.error(message, details);
  }
};

const producer = new KafkaEventProducer(
  nativeProducer,
  logger
);

const app = express();
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    service: "kafka-traffic-test"
  });
});

app.post("/publish", async (req, res) => {
  const event = createEvent({
    type: "BALL_RECORDED",
    aggregateId: `test-match-${runId}`,
    requestId: randomUUID(),
    traceId: randomUUID(),
    payload: {
      matchId: runId,
      sequence: req.body.sequence,
      source: "isolated-traffic-benchmark"
    }
  });

  try {
    await producer.publish(topic, event);

    return res.status(200).json({
      success: true,
      eventId: event.eventId
    });

  } catch {
    return res.status(503).json({
      success: false,
      error: "Kafka publishing unavailable"
    });
  }
});

const server = createServer(app);

let baseUrl;
let serverListening = false;
let brokerStopped = false;
let timer = null;
let phase = "transition";
let inFlight = 0;
let sequence = 0;

const pending = new Set();

function recordRequest(kind, currentPhase) {
  const started = performance.now();
  inFlight++;

  const operation = (async () => {
    let status = 0;
    let success = false;

    try {
      const isPublish = kind === "publish";

      const response = await fetch(
        `${baseUrl}${isPublish ? "/publish" : "/health"}`,
        {
          method: isPublish ? "POST" : "GET",
          headers: {
            "content-type": "application/json"
          },
          body: isPublish
            ? JSON.stringify({ sequence: sequence++ })
            : undefined,
          signal: AbortSignal.timeout(8000)
        }
      );

      status = response.status;

      const body = await response.json();

      success = body.success === true;

    } catch (error) {
      report.warnings.push(
        `HTTP request error: ${error.message}`
      );

    } finally {
      records[currentPhase].push({
        kind,
        status,
        success,
        latencyMs: Math.round(
          performance.now() - started
        )
      });

      inFlight--;
    }
  })();

  pending.add(operation);
  operation.finally(() => pending.delete(operation));
}

async function drain() {
  await waitFor(
    () => inFlight === 0,
    "in-flight HTTP requests",
    15000
  );
}

async function runPhase(name, durationMs) {
  phase = name;
  await sleep(durationMs);

  // Keep the traffic generator alive while allowing
  // requests already started in this phase to finish.
  phase = "transition";
  await drain();
}

function verifyPhase(name, expectedPublishStatus) {
  const rows = records[name];
  const publishes = rows.filter(x => x.kind === "publish");
  const health = rows.filter(x => x.kind === "health");

  assert(
    publishes.length >= 5,
    `Insufficient Kafka publishing traffic during ${name}`
  );

  assert(
    health.length >= 5,
    `Insufficient HTTP health traffic during ${name}`
  );

  assert(
    publishes.every(
      x =>
        x.status === expectedPublishStatus &&
        x.success === (expectedPublishStatus === 200)
    ),
    `Unexpected Kafka publishing outcome during ${name}`
  );

  assert(
    health.every(
      x => x.status === 200 && x.success
    ),
    `Independent HTTP traffic failed during ${name}`
  );
}

async function main() {
  assertIsolation();

  await admin.connect();

  await admin.createTopics({
    waitForLeaders: true,
    topics: [{
      topic,
      numPartitions: 1,
      replicationFactor: 1
    }]
  });

  await nativeProducer.connect();

  await new Promise((resolve, reject) => {
    server.once("error", reject);

    server.listen(
      0,
      "127.0.0.1",
      resolve
    );
  });

  serverListening = true;
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // Alternate independent health traffic and publishing.
 timer = setInterval(() => {
  // Do not generate new requests during transitions.
  // This allows in-flight requests to finish.
  if (
    !["baseline", "outage", "recovery"].includes(phase)
  ) {
    return;
  }

  if (inFlight >= 4) {
    return;
  }

  const currentPhase = phase;

  recordRequest("health", currentPhase);

  if (inFlight < 4) {
    recordRequest("publish", currentPhase);
  }
}, 120);

  // 1. Healthy Kafka baseline.
  await runPhase("baseline", 1800);
  verifyPhase("baseline", 200);

  report.baselinePublishingSucceeded = true;

  // 2. Stop isolated Kafka broker.
  brokerStopped = true;

  docker("stop", "--time", "1", CONTAINER);

  report.brokerStopped =
    docker(
      "inspect",
      "--format",
      "{{.State.Running}}",
      CONTAINER
    ) === "false";

  assert.equal(report.brokerStopped, true);

  // 3. Continue traffic during complete Kafka outage.
  await runPhase("outage", 4000);

  verifyPhase("outage", 503);

  report.publishingFailureDetected = true;
  report.noFalseAcknowledgements = true;

  // 4. Restart the same Kafka broker.
  docker("start", CONTAINER);
  brokerStopped = false;

  await waitForBroker();
  report.brokerRestarted = true;

  // Reuse the original KafkaJS producer.
  await runPhase("recovery", 2500);
  verifyPhase("recovery", 200);

  report.originalProducerRecovered = true;
  report.postRecoveryPublishingSucceeded = true;

  // Independent HTTP endpoint remained healthy
  // across baseline, outage and recovery.
  report.independentHttpTrafficSurvived = [
    "baseline",
    "outage",
    "recovery"
  ].every(name =>
    records[name]
      .filter(x => x.kind === "health")
      .every(x => x.status === 200 && x.success)
  );

  report.passed = [
    report.isolated,
    report.baselinePublishingSucceeded,
    report.brokerStopped,
    report.publishingFailureDetected,
    report.noFalseAcknowledgements,
    report.brokerRestarted,
    report.originalProducerRecovered,
    report.independentHttpTrafficSurvived,
    report.postRecoveryPublishingSucceeded
  ].every(Boolean);
}

try {
  await main();

} catch (error) {
  report.failures.push(
    error.stack ?? String(error)
  );

} finally {
  if (timer) clearInterval(timer);

  await Promise.allSettled([...pending]);

  if (brokerStopped) {
    try {
      docker("start", CONTAINER);
      await waitForBroker();
    } catch (error) {
      report.failures.push(
        `Kafka restore: ${error.message}`
      );
    }
  }

  if (serverListening) {
    await new Promise(resolve => server.close(resolve));
  }

  for (const [name, client] of [
    ["producer", nativeProducer],
    ["admin", admin]
  ]) {
    try {
      await Promise.race([
        client.disconnect(),
        sleep(10000).then(() => {
          throw new Error(`${name} cleanup timeout`);
        })
      ]);
    } catch (error) {
      report.warnings.push(
        `${name} cleanup: ${error.message}`
      );
    }
  }

  for (const name of [
    "baseline",
    "outage",
    "recovery",
    "transition"
  ]) {
    report.traffic[name] = summarize(name);

    report.traffic[name].publishes =
      records[name].filter(x => x.kind === "publish").length;

    report.traffic[name].healthRequests =
      records[name].filter(x => x.kind === "health").length;
  }

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

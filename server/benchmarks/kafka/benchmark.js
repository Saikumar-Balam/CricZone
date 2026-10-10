import { Kafka, Partitioners } from "kafkajs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import fs from "node:fs/promises";

import { loadBenchmarkConfig } from "./config/benchmarkConfig.js";
import { validateBenchmarkEnvironment } from "./config/validateBenchmarkEnvironment.js";

const MODES = [
  "producer_single",
  "producer_batch",
  "consumer",
  "end_to_end",
  "concurrent_producers",
  "payload_size",
  "backlog"
];

const TIMEOUT_MS = 120000;
const BATCH_SIZE = 100;

function percentile(values, percentage) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentage / 100) * sorted.length) - 1;

  return sorted[Math.max(0, index)];
}

function calculateLatency(values) {
  if (!values.length) {
    return {
      average: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      max: 0
    };
  }

  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    average: total / values.length,
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    max: Math.max(...values)
  };
}

function createEvent(index, payloadBytes) {
  const event = {
    eventId: randomUUID(),
    type: "BALL_RECORDED",
    aggregateId: `benchmark-match-${index % 100}`,
    timestamp: new Date().toISOString(),
    payload: {
      inningsId: `benchmark-innings-${index % 100}`,
      inningsNumber: 1,
      overNumber: Math.floor(index / 6) % 20,
      ballNumber: (index % 6) + 1,
      strikerId: "benchmark-player-1",
      nonStrikerId: "benchmark-player-2",
      bowlerId: "benchmark-player-3",
      runs: index % 7,
      extras: 0,
      boundary: index % 7 === 4,
      wicket: { occurred: false },
      legalDelivery: true
    }
  };

  const baseSize = Buffer.byteLength(JSON.stringify(event));
  event.padding = "x".repeat(Math.max(0, payloadBytes - baseSize));

  return event;
}

function createEvents(config) {
  return Array.from(
    { length: config.totalEvents },
    (_, index) => createEvent(index, config.payloadBytes)
  );
}

function toMessage(event) {
  return {
    key: String(event.aggregateId),
    value: JSON.stringify(event)
  };
}

async function runWorkers(count, concurrency, operation) {
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(count, concurrency) },
    async () => {
      while (true) {
        const index = nextIndex++;

        if (index >= count) return;

        await operation(index);
      }
    }
  );

  await Promise.all(workers);
}

function createResult({
  mode,
  totalEvents,
  successfulEvents,
  failedEvents,
  duplicateEvents = 0,
  missingEvents = 0,
  durationMs,
  latencies,
  details = {}
}) {
  return {
    mode,
    totalEvents,
    successfulEvents,
    failedEvents,
    duplicateEvents,
    missingEvents,
    durationSeconds: durationMs / 1000,
    throughputEventsPerSecond:
      durationMs > 0 ? (successfulEvents * 1000) / durationMs : 0,
    latencyMs: calculateLatency(latencies),
    details
  };
}

async function publishEvents({
  producer,
  topic,
  events,
  concurrency,
  batchSize = 1
}) {
  const batches = [];

  for (let index = 0; index < events.length; index += batchSize) {
    batches.push(events.slice(index, index + batchSize));
  }

  const latencies = [];
  let successfulEvents = 0;
  let failedEvents = 0;

  const start = performance.now();

  await runWorkers(batches.length, concurrency, async index => {
    const batch = batches[index];
    const requestStart = performance.now();

    try {
      await producer.send({
        topic,
        acks: -1,
        messages: batch.map(toMessage)
      });

      const latency = performance.now() - requestStart;

      latencies.push(latency);
      successfulEvents += batch.length;
    } catch (error) {
      failedEvents += batch.length;
      console.error("Kafka publish failed:", error.message);
    }
  });

  return {
    durationMs: performance.now() - start,
    latencies,
    successfulEvents,
    failedEvents,
    batches: batches.length
  };
}

async function runProducerSingle(context) {
  const { config, producer, events } = context;

  const result = await publishEvents({
    producer,
    topic: config.topic,
    events,
    concurrency: 1
  });

  return createResult({
    mode: "producer_single",
    totalEvents: events.length,
    successfulEvents: result.successfulEvents,
    failedEvents: result.failedEvents,
    durationMs: result.durationMs,
    latencies: result.latencies,
    details: {
      batchSize: 1,
      concurrency: 1,
      latencyUnit: "Kafka send request"
    }
  });
}

async function runProducerBatch(context) {
  const { config, producer, events } = context;

  const result = await publishEvents({
    producer,
    topic: config.topic,
    events,
    concurrency: 1,
    batchSize: BATCH_SIZE
  });

  return createResult({
    mode: "producer_batch",
    totalEvents: events.length,
    successfulEvents: result.successfulEvents,
    failedEvents: result.failedEvents,
    durationMs: result.durationMs,
    latencies: result.latencies,
    details: {
      batchSize: BATCH_SIZE,
      totalBatches: result.batches,
      latencyUnit: "Kafka batch send request"
    }
  });
}

async function runConcurrentProducers(context) {
  const { config, producer, events } = context;

  const result = await publishEvents({
    producer,
    topic: config.topic,
    events,
    concurrency: config.concurrency
  });

  return createResult({
    mode: "concurrent_producers",
    totalEvents: events.length,
    successfulEvents: result.successfulEvents,
    failedEvents: result.failedEvents,
    durationMs: result.durationMs,
    latencies: result.latencies,
    details: {
      concurrency: config.concurrency,
      sharedProducer: true,
      latencyUnit: "Kafka send request"
    }
  });
}

async function runPayloadSize(context) {
  const { config, producer, events } = context;

  const result = await publishEvents({
    producer,
    topic: config.topic,
    events,
    concurrency: config.concurrency
  });

  return createResult({
    mode: "payload_size",
    totalEvents: events.length,
    successfulEvents: result.successfulEvents,
    failedEvents: result.failedEvents,
    durationMs: result.durationMs,
    latencies: result.latencies,
    details: {
      payloadBytes: config.payloadBytes,
      concurrency: config.concurrency,
      latencyUnit: "Kafka send request"
    }
  });
}

async function consumeExpectedEvents({
  kafka,
  config,
  events,
  producer,
  publishDuringConsumption = false
}) {
  const expectedIds = new Set(events.map(event => event.eventId));
  const receivedIds = new Set();
  const latencies = [];

  let duplicateEvents = 0;
  let unexpectedEvents = 0;
  let startedAt = 0;
  let finishedAt = 0;
  let resolveCompletion;
  let rejectCompletion;
  let timeoutHandle;

  const completion = new Promise((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  // Attach a rejection handler immediately, including during consumer startup.
  completion.catch(() => {});

  const consumer = kafka.consumer({
    groupId: config.consumerGroup,
    sessionTimeout: 30000
  });

  let connected = false;
  let running = false;

  try {
    await consumer.connect();
    connected = true;

    await consumer.subscribe({
      topic: config.topic,
      fromBeginning: true
    });

    // Resolve only after this consumer has received partition assignments.
    const assigned = new Promise((resolve, reject) => {
      const assignmentTimeout = setTimeout(
        () => reject(new Error("Consumer assignment timed out")),
        30000
      );

      consumer.on(consumer.events.GROUP_JOIN, () => {
        clearTimeout(assignmentTimeout);
        resolve();
      });
    });

    await consumer.run({
      autoCommit: true,
      eachMessage: async ({ message }) => {
        const receivedAt = performance.now();
        const event = JSON.parse(message.value.toString());

        if (!expectedIds.has(event.eventId)) {
          unexpectedEvents++;
          return;
        }

        if (receivedIds.has(event.eventId)) {
          duplicateEvents++;
          return;
        }

        receivedIds.add(event.eventId);

        if (publishDuringConsumption) {
          const sentAt = sendTimes.get(event.eventId);

          if (sentAt !== undefined) {
            latencies.push(receivedAt - sentAt);
          }
        }

        if (receivedIds.size === expectedIds.size) {
          finishedAt = performance.now();
          resolveCompletion();
        }
      }
    });

    running = true;
    await assigned;

    if (!publishDuringConsumption) {
      startedAt = performance.now();
    }

    timeoutHandle = setTimeout(() => {
      rejectCompletion(
        new Error(
          `Consumer timeout: received ${receivedIds.size}/${expectedIds.size}`
        )
      );
    }, TIMEOUT_MS);

    if (publishDuringConsumption) {
      startedAt = performance.now();

      const publication = await publishEventsWithTimestamps({
        producer,
        topic: config.topic,
        events,
        concurrency: config.concurrency,
        sendTimes
      });

      if (publication.failedEvents > 0) {
        throw new Error(
          `${publication.failedEvents} Kafka publish operations failed`
        );
      }
    }

    await completion;

    const durationMs = finishedAt - startedAt;

    return {
      durationMs,
      successfulEvents: receivedIds.size,
      duplicateEvents,
      unexpectedEvents,
      missingEvents: expectedIds.size - receivedIds.size,
      latencies
    };
  } finally {
    clearTimeout(timeoutHandle);

    if (connected) {
      try {
        if (running) await consumer.stop();
        await consumer.disconnect();
      } catch (error) {
        console.error("Consumer cleanup failed:", error.message);
      }
    }
  }
}

const sendTimes = new Map();

async function publishEventsWithTimestamps({
  producer,
  topic,
  events,
  concurrency,
  sendTimes
}) {
  let successfulEvents = 0;
  let failedEvents = 0;

  await runWorkers(events.length, concurrency, async index => {
    const event = events[index];

    sendTimes.set(event.eventId, performance.now());

    try {
      await producer.send({
        topic,
        acks: -1,
        messages: [toMessage(event)]
      });

      successfulEvents++;
    } catch (error) {
      failedEvents++;
      console.error("Kafka publish failed:", error.message);
    }
  });

  return { successfulEvents, failedEvents };
}

async function runConsumer(context) {
  const { config, kafka, producer, events } = context;

  const publication = await publishEvents({
    producer,
    topic: config.topic,
    events,
    concurrency: config.concurrency,
    batchSize: BATCH_SIZE
  });

  if (publication.failedEvents > 0) {
    throw new Error("Unable to preload consumer workload");
  }

  const result = await consumeExpectedEvents({
    kafka,
    config,
    events,
    producer
  });

  return createResult({
    mode: "consumer",
    totalEvents: events.length,
    successfulEvents: result.successfulEvents,
    failedEvents: result.missingEvents,
    duplicateEvents: result.duplicateEvents,
    missingEvents: result.missingEvents,
    durationMs: result.durationMs,
    latencies: result.latencies,
    details: {
      unexpectedEvents: result.unexpectedEvents,
      latencyUnit: "Not measured; consumer throughput only"
    }
  });
}

async function runEndToEnd(context) {
  const { config, kafka, producer, events } = context;

  sendTimes.clear();

  const result = await consumeExpectedEvents({
    kafka,
    config,
    events,
    producer,
    publishDuringConsumption: true
  });

  return createResult({
    mode: "end_to_end",
    totalEvents: events.length,
    successfulEvents: result.successfulEvents,
    failedEvents: result.missingEvents,
    duplicateEvents: result.duplicateEvents,
    missingEvents: result.missingEvents,
    durationMs: result.durationMs,
    latencies: result.latencies,
    details: {
      concurrency: config.concurrency,
      unexpectedEvents: result.unexpectedEvents,
      latencyUnit: "Publish attempt to consumer receipt"
    }
  });
}

async function runBacklog(context) {
  const result = await runConsumer(context);

  return {
    ...result,
    mode: "backlog",
    details: {
      ...result.details,
      scenario: "Preloaded Kafka backlog drain"
    }
  };
}

const workloads = {
  producer_single: runProducerSingle,
  producer_batch: runProducerBatch,
  consumer: runConsumer,
  end_to_end: runEndToEnd,
  concurrent_producers: runConcurrentProducers,
  payload_size: runPayloadSize,
  backlog: runBacklog
};

async function main() {
  const config = loadBenchmarkConfig();

  const mode = process.env.BENCHMARK_MODE || "end_to_end";

  if (!MODES.includes(mode)) {
    throw new Error(`Unsupported benchmark mode: ${mode}`);
  }

  const kafka = new Kafka({
    clientId: `criczone-benchmark-${config.runId}`,
    brokers: config.brokers,
    ssl: false,
    retry: {
      retries: 5
    },
    logLevel: 1
  });

  const producer = kafka.producer({
    createPartitioner: Partitioners.DefaultPartitioner
  });

  let producerConnected = false;

  try {
    await validateBenchmarkEnvironment(kafka, config);

    await producer.connect();
    producerConnected = true;

    const events = createEvents(config);

    console.log("Starting CricZone Kafka benchmark");
    console.log("Mode:", mode);
    console.log("Events:", config.totalEvents);
    console.log("Concurrency:", config.concurrency);
    console.log("Payload bytes:", config.payloadBytes);
    console.log("Topic:", config.topic);

    const result = await workloads[mode]({
      kafka,
      producer,
      config,
      events
    });

    const report = {
      application: "CricZone",
      benchmark: "Kafka Event Throughput",
      timestamp: new Date().toISOString(),
      broker: config.brokers,
      topic: config.topic,
      consumerGroup: config.consumerGroup,
      ...result
    };

    await fs.writeFile(
      process.env.BENCHMARK_OUTPUT_FILE ||
        "kafka-benchmark-results.json",
      JSON.stringify(report, null, 2)
    );

    console.log(JSON.stringify(report, null, 2));

    if (
      result.failedEvents > 0 ||
      result.duplicateEvents > 0 ||
      result.missingEvents > 0 ||
      result.successfulEvents !== result.totalEvents
    ) {
      throw new Error("Kafka benchmark correctness validation failed");
    }

    console.log("Kafka benchmark PASSED");
  } finally {
    if (producerConnected) {
      await producer.disconnect();
    }

    const admin = kafka.admin();

    try {
      await admin.connect();

      await admin.deleteTopics({
        topics: [config.topic],
        timeout: 30000
      });

      console.log("Benchmark topic cleaned up");
    } catch (error) {
      console.error("Benchmark cleanup failed:", error.message);
    } finally {
      await admin.disconnect().catch(() => {});
    }
  }
}

main().catch(error => {
  console.error("Kafka benchmark FAILED:", error);
  process.exitCode = 1;
});
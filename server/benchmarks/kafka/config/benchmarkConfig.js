import { randomUUID } from "node:crypto";

export function loadBenchmarkConfig() {
  const brokers = (
    process.env.BENCHMARK_KAFKA_BROKERS ||
    "127.0.0.1:9092"
  )
    .split(",")
    .map(broker => broker.trim())
    .filter(Boolean);

  const totalEvents = Number(
    process.env.BENCHMARK_TOTAL_EVENTS || 1000
  );

  const concurrency = Number(
    process.env.BENCHMARK_CONCURRENCY || 10
  );

  const payloadBytes = Number(
    process.env.BENCHMARK_PAYLOAD_BYTES || 1024
  );

  if (
    !Number.isInteger(totalEvents) ||
    totalEvents < 1 ||
    totalEvents > 100000
  ) {
    throw new Error("Invalid BENCHMARK_TOTAL_EVENTS");
  }

  if (
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 50
  ) {
    throw new Error("Invalid BENCHMARK_CONCURRENCY");
  }

  if (
    !Number.isInteger(payloadBytes) ||
    payloadBytes < 128 ||
    payloadBytes > 10240
  ) {
    throw new Error("Invalid BENCHMARK_PAYLOAD_BYTES");
  }

  if (
    brokers.length === 0 ||
    brokers.some(
      broker =>
        !/^(localhost|127\.0\.0\.1):\d+$/.test(broker)
    )
  ) {
    throw new Error(
      "Kafka benchmarks must use a local broker"
    );
  }

  const runId = randomUUID();

  return {
    brokers,
    totalEvents,
    concurrency,
    payloadBytes,
    runId,
    topic: `criczone.benchmark.${runId}`,
    consumerGroup: `criczone-benchmark-${runId}`
  };
}
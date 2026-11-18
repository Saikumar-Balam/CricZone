
import { createClient } from "redis";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import RedisCache from "../../../src/cache/RedisCache.js";
import RedisLiveCache from "../../../src/cache/redis/RedisLiveCache.js";
import { CacheKeys } from "../../../src/cache/CacheKeys.js";

const EXPECTED_URL = "redis://127.0.0.1:56379";

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.NODE_ENV !== "test" ||
  process.env.REDIS_URL !== EXPECTED_URL
) {
  throw new Error("Isolated GitHub Actions environment required");
}

const runId = randomUUID();
const samples = [];
const traceEvents = [];
const sampleCount = 50;

const output =
  "benchmarks/resilience/valkey/reports/baseline.json";

const client = createClient({
  url: process.env.REDIS_URL,
  socket: { connectTimeout: 3000 }
});

client.on("error", (error) => {
  console.error("Valkey client error:", error.code);
});

const logger = {
  warn: (message, details) =>
    console.warn(message, details)
};

const cache = new RedisCache(client, logger);
const liveCache = new RedisLiveCache(client);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function measure(operation, action) {
  const traceId = randomUUID();
  const start = performance.now();
  let success = false;

  try {
    await action();
    success = true;
  } finally {
    const durationMs = performance.now() - start;

    samples.push({
      operation,
      durationMs,
      success
    });

    if (traceEvents.length < 10) {
      traceEvents.push({
        traceId,
        operation,
        durationMs: Number(durationMs.toFixed(3)),
        success
      });
    }
  }
}

function percentile(sorted, p) {
  const index = Math.max(
    0,
    Math.ceil(sorted.length * p / 100) - 1
  );
  return sorted[index];
}

function summarize(operation) {
  const rows = samples.filter(
    item => item.operation === operation
  );

  const durations = rows
    .map(item => item.durationMs)
    .sort((a, b) => a - b);

  const round = value => Number(value.toFixed(3));
  const failures = rows.filter(item => !item.success).length;

  return {
    count: rows.length,
    failures,
    successRatePercent: round(
      ((rows.length - failures) / rows.length) * 100
    ),
    p50Ms: round(percentile(durations, 50)),
    p95Ms: round(percentile(durations, 95)),
    p99Ms: round(percentile(durations, 99)),
    averageMs: round(
      durations.reduce((a, b) => a + b, 0) /
      durations.length
    )
  };
}

const keys = [];

try {
  await client.connect();

  assert(await client.ping() === "PONG", "PING failed");

  const startedAt = performance.now();

  for (let i = 0; i < sampleCount; i++) {
    const key = `resilience:${runId}:${i}`;
    const matchId = 900000 + i;

    keys.push(key);
    keys.push(CacheKeys.matchLive(matchId));

    await measure("cache_set", async () => {
      await cache.set(key, { runs: i }, 120);
      assert(
        await client.get(key) !== null,
        "Cache SET verification failed"
      );
    });

    await measure("cache_get", async () => {
      const result = await cache.get(key);
      assert(
        result?.runs === i,
        "Cache GET verification failed"
      );
    });

    await measure("live_state_set", async () => {
      await liveCache.setLiveState(matchId, {
        matchId,
        runs: i
      });
    });

    await measure("live_state_get", async () => {
      const result = await liveCache.getLiveState(matchId);
      assert(
        result?.runs === i,
        "Live state GET verification failed"
      );
    });
  }

  const totalDurationMs = performance.now() - startedAt;
  const successful = samples.filter(s => s.success).length;

  const report = {
    module: "25.7.2.3",
    scenario: "isolated_valkey_baseline",
    runId,
    environment: "GitHub Actions hosted runner",
    sampleCountPerOperation: sampleCount,
    metrics: {
      cacheSet: summarize("cache_set"),
      cacheGet: summarize("cache_get"),
      liveStateSet: summarize("live_state_set"),
      liveStateGet: summarize("live_state_get"),
      throughputOperationsPerSecond: Number(
        (successful / (totalDurationMs / 1000)).toFixed(2)
      ),
      totalDurationMs: Number(totalDurationMs.toFixed(3))
    },
    traceEvents,
    passed: successful === sampleCount * 4
  };

  fs.mkdirSync(
    "benchmarks/resilience/valkey/reports",
    { recursive: true }
  );

  fs.writeFileSync(
    output,
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));

  assert(report.passed, "Baseline failed");
} finally {
  if (client.isReady && keys.length > 0) {
    await client.del(keys);
  }

  if (client.isOpen) {
    client.destroy();
  }
}


import { createClient } from "redis";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

import RedisCache from "../../src/cache/RedisCache.js";
import RedisLiveCache from "../../src/cache/redis/RedisLiveCache.js";
import { CacheKeys } from "../../src/cache/CacheKeys.js";

import { loadBenchmarkConfig } from "./config/benchmarkConfig.js";
import { validateBenchmarkEnvironment } from "./config/validateBenchmarkEnvironment.js";

// 
// 1. Benchmark configuration
// 

const ALLOWED_MODES = [
  "read",
  "write",
  "commentary",
  "invalidation",
  "ttl",
  "mixed",
  "live_ball"
];

const BENCHMARK_MODE =
  process.env.BENCHMARK_MODE ?? "read";

const CONCURRENCY = Number(
  process.env.BENCHMARK_CONCURRENCY ?? 10
);

const TOTAL_OPERATIONS = Number(
  process.env.BENCHMARK_TOTAL_OPERATIONS ?? 300
);

const OUTPUT_FILE =
  process.env.BENCHMARK_OUTPUT_FILE ??
  "valkey-benchmark-results.json";

const RUN_ID = randomUUID();

// 
// 2. Validate configuration
// 

function validateConfiguration() {
  if (!ALLOWED_MODES.includes(BENCHMARK_MODE)) {
    throw new Error(
      `Invalid BENCHMARK_MODE: ${BENCHMARK_MODE}`
    );
  }

  if (
    !Number.isSafeInteger(CONCURRENCY) ||
    CONCURRENCY < 1 ||
    CONCURRENCY > 50
  ) {
    throw new Error(
      "BENCHMARK_CONCURRENCY must be between 1 and 50"
    );
  }

  if (
    !Number.isSafeInteger(TOTAL_OPERATIONS) ||
    TOTAL_OPERATIONS < 1 ||
    TOTAL_OPERATIONS > 10000
  ) {
    throw new Error(
      "BENCHMARK_TOTAL_OPERATIONS must be between 1 and 10000"
    );
  }

  if (
    typeof OUTPUT_FILE !== "string" ||
    OUTPUT_FILE.includes("/") ||
    OUTPUT_FILE.includes("\\") ||
    !/^[a-zA-Z0-9_-]+\.json$/.test(OUTPUT_FILE)
  ) {
    throw new Error(
      "BENCHMARK_OUTPUT_FILE must be a safe JSON filename"
    );
  }
}

// 
// 3. Statistics helpers
// 

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return null;
  }

  const index = Math.max(
    0,
    Math.ceil((p / 100) * sortedValues.length) - 1
  );

  return sortedValues[index];
}

function summarize(values) {
  if (values.length === 0) {
    return {
      count: 0,
      averageMs: null,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null
    };
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const sum = values.reduce(
    (total, value) => total + value,
    0
  );

  const round = value =>
    Number(value.toFixed(3));

  return {
    count: values.length,
    averageMs: round(sum / values.length),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(percentile(sorted, 95)),
    p99Ms: round(percentile(sorted, 99)),
    maxMs: round(sorted[sorted.length - 1])
  };
}

// 
// 4. Benchmark key isolation
// 

function createNamespacedClient(client, prefix) {
  const key = value => `${prefix}${value}`;

  return {
    get: value =>
      client.get(key(value)),

    set: (value, data, options) =>
      client.set(key(value), data, options),

    del: (...values) =>
      client.del(values.flat().map(key)),

    lPush: (value, data) =>
      client.lPush(key(value), data),

    lTrim: (value, start, stop) =>
      client.lTrim(key(value), start, stop),

    lRange: (value, start, stop) =>
      client.lRange(key(value), start, stop),

    expire: (value, seconds) =>
      client.expire(key(value), seconds)
  };
}

// 
// 5. Synthetic cricket data
// 

function createLiveState(matchId, sequence = 1) {
  return {
    matchId,
    inningsId: matchId * 10,
    inningsNumber: 1,

    score: {
      runs: 156 + sequence,
      wickets: 4,
      legalBalls: 105,
      extras: 8
    },

    lastDelivery: {
      deliveryId: sequence,
      overNumber: 17,
      ballNumber: 3,
      batsmanRuns: 4,
      extraRuns: 0,
      totalRuns: 4,
      wicket: false,
      four: true,
      six: false
    },

    inningsCompleted: false,
    completionReason: null,
    updatedAt: new Date().toISOString()
  };
}

function createCommentary(matchId, index) {
  return {
    eventId: `bench-${matchId}-${index}`,
    matchId,
    eventType: "BALL",
    text: "FOUR runs",
    sequenceNumber: index
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(
      `Correctness failure: ${message}`
    );
  }
}

// 
// 6. Prepare benchmark data
// 

async function prepareBenchmarkData(
  mode,
  total,
  cache,
  liveCache
) {
  const operations = [];

  const mixedModes = [
    "read",
    "read",
    "read",
    "write",
    "commentary",
    "invalidation",
    "live_ball"
  ];

  for (let i = 0; i < total; i++) {
    const matchId = 100000 + i;

    const selectedMode =
      mode === "mixed"
        ? mixedModes[i % mixedModes.length]
        : mode;

    const state = createLiveState(matchId, i);

    if (selectedMode === "read") {
      await liveCache.setLiveState(
        matchId,
        state
      );
    }

    if (
      selectedMode === "invalidation" ||
      selectedMode === "live_ball" ||
      selectedMode === "ttl"
    ) {
      const scorecardWritten = await cache.set(
        CacheKeys.scorecardByMatchId(matchId),
        { matchId, innings: [] },
        60
      );

      const summaryWritten = await cache.set(
        CacheKeys.matchSummary(matchId),
        { matchId, score: "156/4" },
        60
      );

      assert(
        scorecardWritten !== false &&
        summaryWritten !== false,
        `Failed to seed match ${matchId}`
      );
    }

    if (selectedMode === "ttl") {
      await liveCache.setLiveState(
        matchId,
        state
      );

      await liveCache.appendCommentary(
        matchId,
        createCommentary(matchId, i)
      );
    }

    operations.push({
      selectedMode,
      matchId,
      index: i,
      state
    });
  }

  return operations;
}

// 
// 7. Execute cache workload
// 

async function executeCacheOperation(
  operation,
  liveCache
) {
  const {
    selectedMode,
    matchId,
    index,
    state
  } = operation;

  switch (selectedMode) {
    case "read": {
      const result =
        await liveCache.getLiveState(matchId);

      assert(
        result?.matchId === matchId &&
        result.score?.runs === state.score.runs,
        "Unexpected cached live state"
      );

      break;
    }

    case "write":
      await liveCache.setLiveState(
        matchId,
        state
      );
      break;

    case "commentary":
      await liveCache.appendCommentary(
        matchId,
        createCommentary(matchId, index)
      );
      break;

    case "invalidation":
      await liveCache.invalidateScorecard(matchId);
      await liveCache.invalidateSummary(matchId);
      break;

    case "ttl":
      await liveCache.promoteCompletedMatch(matchId);
      break;

    case "live_ball":
      await liveCache.setLiveState(matchId, state);
      await liveCache.invalidateScorecard(matchId);
      await liveCache.invalidateSummary(matchId);
      await liveCache.appendCommentary(
        matchId,
        createCommentary(matchId, index)
      );
      break;

    default:
      throw new Error(
        `Unsupported mode: ${selectedMode}`
      );
  }
}

// 
// 8. Validate benchmark results
// 

async function validateBenchmarkResults(
  operations,
  client,
  prefix,
  liveCache
) {
  const failures = [];

  for (const operation of operations) {
    const {
      selectedMode,
      matchId,
      index,
      state
    } = operation;

    try {
      if (
        selectedMode === "read" ||
        selectedMode === "write" ||
        selectedMode === "live_ball"
      ) {
        const result =
          await liveCache.getLiveState(matchId);

        assert(
          result?.matchId === matchId &&
          result.score?.runs === state.score.runs,
          `Live-state verification failed for match ${matchId}`
        );
      }

      if (
        selectedMode === "commentary" ||
        selectedMode === "live_ball"
      ) {
        const events =
          await liveCache.getRecentCommentary(matchId);

        assert(
          events.some(
            event =>
              event.eventId ===
              `bench-${matchId}-${index}`
          ),
          `Commentary verification failed for match ${matchId}`
        );
      }

      if (
        selectedMode === "invalidation" ||
        selectedMode === "live_ball"
      ) {
        const scorecardExists =
          await client.exists(
            `${prefix}${CacheKeys.scorecardByMatchId(matchId)}`
          );

        const summaryExists =
          await client.exists(
            `${prefix}${CacheKeys.matchSummary(matchId)}`
          );

        assert(
          scorecardExists === 0 &&
          summaryExists === 0,
          `Invalidation failed for match ${matchId}`
        );
      }

      if (selectedMode === "ttl") {
        const keys = [
          CacheKeys.matchLive(matchId),
          CacheKeys.scorecardByMatchId(matchId),
          CacheKeys.matchSummary(matchId),
          CacheKeys.matchCommentary(matchId)
        ];

        for (const key of keys) {
          const ttl = await client.ttl(
            `${prefix}${key}`
          );

          assert(
            ttl > 0 && ttl <= 3600,
            `Invalid TTL ${ttl} for ${key}`
          );
        }
      }
    } catch (error) {
      failures.push({
        mode: selectedMode,
        index,
        message: error.message
      });
    }
  }

  return failures;
}

// 
// 9. Cleanup benchmark keys
// 

async function cleanupBenchmarkKeys(
  client,
  prefix
) {
  const keys = [];

  for await (
    const batch of client.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100
    })
  ) {
    keys.push(...batch);
  }

  for (let i = 0; i < keys.length; i += 100) {
    await client.del(
      keys.slice(i, i + 100)
    );
  }

  let remainingCount = 0;

  for await (
    const batch of client.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100
    })
  ) {
    remainingCount += batch.length;
  }

  if (remainingCount > 0) {
    throw new Error(
      `Benchmark cleanup incomplete: ${remainingCount} keys remain`
    );
  }
}

// 
// 10. Run concurrent benchmark
// 

async function main() {
  validateConfiguration();

  const config = loadBenchmarkConfig();

  const prefix =
    `${config.keyPrefix}${RUN_ID}:`;

  const client = createClient({
    url: config.connectionUrl
  });

  client.on("error", error => {
    console.error(
      "Benchmark Valkey client error:",
      error.message
    );
  });

  try {
    await client.connect();

    await validateBenchmarkEnvironment(client);

    const benchmarkClient =
      createNamespacedClient(client, prefix);

    const logger = {
      error: (...args) => console.error(...args),
      warn: (...args) => console.warn(...args)
    };

    const cache = new RedisCache(
      benchmarkClient,
      logger
    );

    const liveCache = new RedisLiveCache(
      benchmarkClient
    );

    console.log(
      "Starting CricZone Valkey benchmark"
    );

    console.log({
      mode: BENCHMARK_MODE,
      concurrency: CONCURRENCY,
      totalOperations: TOTAL_OPERATIONS
    });

    const operations =
      await prepareBenchmarkData(
        BENCHMARK_MODE,
        TOTAL_OPERATIONS,
        cache,
        liveCache
      );

    // Warm up connection and cache.
    await liveCache.setLiveState(
      99999,
      createLiveState(99999)
    );

    await liveCache.getLiveState(99999);

    const samples = [];
    const errors = [];
    const byMode = {};

    let nextIndex = 0;

    async function worker() {
      while (true) {
        const index = nextIndex++;

        if (index >= operations.length) {
          return;
        }

        const operation = operations[index];
        const start = performance.now();

        try {
          await executeCacheOperation(
            operation,
            liveCache
          );

          const duration =
            performance.now() - start;

          samples.push(duration);

          if (!byMode[operation.selectedMode]) {
            byMode[operation.selectedMode] = [];
          }

          byMode[operation.selectedMode].push(
            duration
          );

          if (index < 5) {
            console.log(
              `${operation.selectedMode}: ${duration.toFixed(3)} ms`
            );
          }
        } catch (error) {
          errors.push({
            mode: operation.selectedMode,
            index,
            message: error.message
          });
        }
      }
    }

    const startedAt =
      new Date().toISOString();

    const start = performance.now();

    await Promise.all(
      Array.from(
        { length: CONCURRENCY },
        () => worker()
      )
    );

    const elapsedSeconds =
      (performance.now() - start) / 1000;

    // Validate after measurement, not inside timing.
    const validationFailures =
      await validateBenchmarkResults(
        operations,
        client,
        prefix,
        liveCache
      );

    const successfulOperations = samples.length;

    const failedOperations =
      TOTAL_OPERATIONS - successfulOperations;

    const validationFailureCount =
      validationFailures.length;

    const report = {
      benchmark:
        "CricZone Valkey Cache Performance Test",

      startedAt,

      environment: {
        engine: "Valkey",
        version: config.expectedValkeyVersion,
        connectionType: "local-container"
      },

      configuration: {
        mode: BENCHMARK_MODE,
        concurrency: CONCURRENCY,
        totalOperations: TOTAL_OPERATIONS
      },

      results: {
        attemptedOperations: TOTAL_OPERATIONS,
        successfulOperations,
        failedOperations,

        validationFailureCount,
        validationPassed:
          validationFailureCount === 0,

        errorRatePercent: Number(
          (
            (failedOperations / TOTAL_OPERATIONS) *
            100
          ).toFixed(2)
        ),

        durationSeconds: Number(
          elapsedSeconds.toFixed(3)
        ),

        throughputOpsPerSecond: Number(
          (
            successfulOperations /
            elapsedSeconds
          ).toFixed(2)
        ),

        latency: summarize(samples)
      },

      workloadBreakdown:
        Object.fromEntries(
          Object.entries(byMode).map(
            ([name, values]) => [
              name,
              summarize(values)
            ]
          )
        ),

      errors: [
        ...errors,
        ...validationFailures
      ].slice(0, 20)
    };

    console.log(
      "\n=== Valkey Benchmark Results ==="
    );

    console.log(
      JSON.stringify(report, null, 2)
    );

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(report, null, 2)
    );

    if (
      failedOperations > 0 ||
      validationFailureCount > 0
    ) {
      process.exitCode = 1;
    }
  } finally {
    if (client.isReady) {
      try {
        await cleanupBenchmarkKeys(
          client,
          prefix
        );
      } finally {
        await client.quit();
      }
    } else if (client.isOpen) {
      client.disconnect();
    }
  }
}

// 
// 11. Application entry point
// 

try {
  await main();
} catch (error) {
  console.error(
    "Valkey benchmark failed:",
    error.message
  );

  process.exitCode = 1;
}

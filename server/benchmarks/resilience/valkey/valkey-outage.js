
import { createClient } from "redis";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";

import RedisCache from "../../../src/cache/RedisCache.js";

const URL = "redis://127.0.0.1:56379";
const OUTPUT =
  "benchmarks/resilience/valkey/reports/outage.json";

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.NODE_ENV !== "test" ||
  process.env.REDIS_URL !== URL
) {
  throw new Error("Isolated GitHub Actions environment required");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function docker(...args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 15000
  }).trim();
}

function findContainer() {
  const ids = docker(
    "ps",
    "--filter",
    "publish=56379",
    "--format",
    "{{.ID}}"
  ).split("\n").filter(Boolean);

  assert(ids.length === 1, "Expected one isolated Valkey container");

  const image = docker(
    "inspect",
    "--format",
    "{{.Config.Image}}",
    ids[0]
  );

  assert(
    image === "valkey/valkey:8-alpine",
    "Unexpected container image"
  );

  return ids[0];
}

const runId = randomUUID();
const containerId = findContainer();

const client = createClient({
  url: URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 3000,
    reconnectStrategy: () => 250
  }
});

const errors = [];
const warnings = [];

const logger = {
  warn(message, details) {
    warnings.push({
      message,
      errorMessage: details?.errorMessage
    });
  }
};

client.on("error", error => {
  errors.push({
    name: error.name,
    code: error.code ?? null
  });
});

const cache = new RedisCache(client, logger);

const report = {
  module: "25.7.2.4",
  scenario: "isolated_valkey_outage",
  runId,
  environment: "GitHub Actions",
  target: URL,
  baselineHealthy: false,
  containerStopped: false,
  disconnectDetected: false,
  detectionLatencyMs: null,
  pingRejected: false,
  cacheGetReturnedNull: false,
  cacheWarningObserved: false,
  containerRestarted: false,
  errors: [],
  passed: false
};

let stopped = false;
let failure = null;

try {
  await client.connect();

  assert(
    await client.ping() === "PONG",
    "Baseline PING failed"
  );

  report.baselineHealthy = true;

  const detectionPromise = new Promise(resolve => {
    client.once("reconnecting", () => resolve(true));
    client.once("end", () => resolve(true));
  });

  const startedAt = performance.now();

  docker("stop", "--time", "1", containerId);
  stopped = true;
  report.containerStopped = true;

  const detected = await Promise.race([
    detectionPromise,
    new Promise(resolve =>
      setTimeout(() => resolve(false), 5000)
    )
  ]);

  report.disconnectDetected = detected;

  if (detected) {
    report.detectionLatencyMs = Number(
      (performance.now() - startedAt).toFixed(3)
    );
  }

  assert(detected, "Redis outage was not detected");

  try {
    await client.ping();
  } catch {
    report.pingRejected = true;
  }

  assert(
    report.pingRejected,
    "PING unexpectedly succeeded during outage"
  );

  const result = await cache.get(
    `resilience:${runId}:outage`
  );

  report.cacheGetReturnedNull = result === null;
  report.cacheWarningObserved = warnings.some(
    entry => entry.message === "Redis cache GET failed"
  );

  assert(
    report.cacheGetReturnedNull,
    "Cache fallback result was incorrect"
  );

  assert(
    report.cacheWarningObserved,
    "Cache failure warning was not observed"
  );

  report.passed = true;

} catch (error) {
  failure = error;
  report.errors.push(error.message);

} finally {
  try {
    if (stopped) {
      docker("start", containerId);
      report.containerRestarted = true;
    }
  } catch (error) {
    report.errors.push(
      `Container restart failed: ${error.message}`
    );
    failure ??= error;
  }

  report.errors.push(
    ...errors.slice(0, 10).map(
      error => `${error.name}: ${error.code}`
    )
  );

  report.passed =
    report.passed && report.containerRestarted;

  if (client.isOpen) {
    client.destroy();
  }

  fs.mkdirSync(
    "benchmarks/resilience/valkey/reports",
    { recursive: true }
  );

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
}

if (failure || !report.passed) {
  process.exitCode = 1;
}

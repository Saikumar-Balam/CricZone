
import { createClient } from "redis";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";

const URL = "redis://127.0.0.1:56379";
const OUTPUT =
  "benchmarks/resilience/valkey/reports/recovery.json";

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

  assert(ids.length === 1, "Expected one Valkey container");

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

async function waitFor(predicate, timeoutMs, message) {
  const started = performance.now();

  while (performance.now() - started < timeoutMs) {
    if (predicate()) return;
    await sleep(50);
  }

  throw new Error(message);
}

const runId = randomUUID();
const key = `resilience:recovery:${runId}`;
const containerId = findContainer();

let readyEvents = 0;
let reconnectEvents = 0;
let failure = null;
let restartStartedAt = null;

const client = createClient({
  url: URL,
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 3000,
    reconnectStrategy: retries => Math.min(250 * retries, 1000)
  }
});

const clientIdentity = client;
const clientErrors = [];

client.on("ready", () => {
  readyEvents++;
});

client.on("reconnecting", () => {
  reconnectEvents++;
});

client.on("error", error => {
  clientErrors.push({
    message: error.message,
    code: error.code ?? null
  });
});

const report = {
  module: "25.7.2.5",
  scenario: "original_redis_client_recovery",
  runId,
  target: URL,
  baselineHealthy: false,
  outageDetected: false,
  containerRestarted: false,
  sameClientReused: false,
  automaticallyReconnected: false,
  recoveryLatencyMs: null,
  pingAfterRecovery: false,
  setAfterRecovery: false,
  getAfterRecovery: false,
  readyEvents: 0,
  reconnectEvents: 0,
  clientErrors: [],
  failures: [],
  passed: false
};

try {
  // 1. Establish the original connection.
  await client.connect();

  assert(await client.ping() === "PONG", "Initial PING failed");
  report.baselineHealthy = true;

  // 2. Simulate a real outage.
  docker("stop", "--time", "1", containerId);

  // Give the original client time to detect disconnection.
  await waitFor(
    () => !client.isReady && reconnectEvents > 0,
    5000,
    "Original Redis client did not detect outage"
  );

  report.outageDetected = true;

  // 3. Restart the same Valkey container.
  restartStartedAt = performance.now();

  docker("start", containerId);
  report.containerRestarted = true;

  // 4. Wait for the original client to reconnect.
  await waitFor(
    () => client.isReady && readyEvents >= 2,
    15000,
    "Original Redis client failed to reconnect"
  );

  report.recoveryLatencyMs = Number(
    (performance.now() - restartStartedAt).toFixed(3)
  );

  report.sameClientReused = client === clientIdentity;
  report.automaticallyReconnected = true;

  assert(
    report.sameClientReused,
    "A different Redis client was used"
  );

  // 5. Verify commands work after recovery.
  report.pingAfterRecovery =
    (await client.ping()) === "PONG";

  assert(
    report.pingAfterRecovery,
    "PING failed after recovery"
  );

  const value = JSON.stringify({
    runId,
    recovered: true
  });

  const setResult = await client.set(key, value, {
    EX: 120
  });

  report.setAfterRecovery = setResult === "OK";

  assert(
    report.setAfterRecovery,
    "SET failed after recovery"
  );

  const actual = await client.get(key);

  report.getAfterRecovery = actual === value;

  assert(
    report.getAfterRecovery,
    "GET failed after recovery"
  );

  await client.del(key);

} catch (error) {
  failure = error;
  report.failures.push(error.message);

} finally {
  // Always restore Valkey, including after assertion failures.
  try {
    const running = docker(
      "inspect",
      "--format",
      "{{.State.Running}}",
      containerId
    );

    if (running !== "true") {
      docker("start", containerId);
    }

    const restored = docker(
      "inspect",
      "--format",
      "{{.State.Running}}",
      containerId
    );

    report.containerRestarted = restored === "true";

  } catch (error) {
    report.failures.push(
      `Cleanup failed: ${error.message}`
    );
    failure ??= error;
  }

  report.readyEvents = readyEvents;
  report.reconnectEvents = reconnectEvents;
  report.clientErrors = clientErrors.slice(0, 20);

  report.passed =
    !failure &&
    report.baselineHealthy &&
    report.outageDetected &&
    report.containerRestarted &&
    report.sameClientReused &&
    report.automaticallyReconnected &&
    report.pingAfterRecovery &&
    report.setAfterRecovery &&
    report.getAfterRecovery &&
    Number.isFinite(report.recoveryLatencyMs);

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

if (!report.passed) {
  process.exitCode = 1;
}

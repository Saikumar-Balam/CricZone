
/**
 * CricZone Phase 25.7.5.4
 * Continuous Socket.IO traffic during server failure/recovery.
 *
 * Uses the existing CricZone WebSocket benchmark server.
 * Restricted to isolated GitHub Actions.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";
import { io } from "socket.io-client";

const HOST = "127.0.0.1";
const PORT = 4006;
const BASE = `http://${HOST}:${PORT}`;
const CLIENT_COUNT = 5;
const REDIS_URL = "redis://127.0.0.1:56380";

const runId = randomUUID();
const matchId = `traffic-${runId}`;

const OUTPUT = path.resolve(
  "benchmarks/resilience/traffic/reports/websocket-http.json"
);

const report = {
  phase: "25.7.5.4",
  scenario: "continuous_websocket_traffic_during_server_crash",
  runId,
  clientCount: CLIENT_COUNT,

  isolated: false,
  baselineHealthy: false,
  serverCrashDetected: false,
  outagePublishingRejected: false,
  serverRestarted: false,
  clientsReconnected: false,
  roomSubscriptionsRestored: false,
  postRecoveryDelivered: false,

  reconnectLatencyMs: null,
  duplicateDeliveries: 0,

  traffic: {},
  warnings: [
    "Socket.IO events sent while the server is offline are not replayed.",
    "Clients must re-emit join-match after reconnecting.",
    "This tests a single isolated WebSocket server, not AWS ECS failover."
  ],
  failures: [],
  passed: false
};

function assertIsolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.WS_BENCH_PORT, String(PORT));
  assert.equal(process.env.WS_BENCH_REDIS_URL, REDIS_URL);

  for (const name of [
    "REDIS_URL",
    "DATABASE_URL",
    "KAFKA_BROKERS"
  ]) {
    assert.equal(
      process.env[name],
      undefined,
      `${name} must not be configured`
    );
  }

  report.isolated = true;
}

async function waitFor(check, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      if (await check()) return;
    } catch {
      // An unavailable server is expected during restart.
    }

    await sleep(100);
  }

  throw new Error(`Timeout: ${label}`);
}

async function httpRequest(endpoint, body) {
  const response = await fetch(`${BASE}${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(1500)
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

async function serverAvailable() {
  try {
    const result = await httpRequest("/health");

    return (
      result.status === 200 &&
      result.body.ok === true
    );
  } catch {
    return false;
  }
}

async function roomCount() {
  const result = await httpRequest(
    `/rooms?matchId=${encodeURIComponent(matchId)}`
  );

  return result.body.members;
}

function percentile(values, percentage) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(sorted.length * percentage) - 1;

  return sorted[Math.max(0, index)];
}

function summarize(rows) {
  const latencies = rows.map(x => x.latencyMs);

  return {
    attempts: rows.length,
    acknowledged: rows.filter(x => x.acknowledged).length,
    rejected: rows.filter(x => !x.acknowledged).length,
    p95HttpMs: percentile(latencies, 0.95),
    maxHttpMs: latencies.length
      ? Math.max(...latencies)
      : null
  };
}

let serverProcess = null;
let spawnFailures = [];

const clients = [];
const received = new Map();
const deliveryLatencies = [];

let duplicateDeliveries = 0;
let phase = "transition";
let inFlight = 0;
let timer = null;
let sequence = 0;

const pending = new Set();

const records = {
  baseline: [],
  outage: [],
  recovery: [],
  transition: []
};

function startServer() {
  const child = spawn(
    process.execPath,
    [
      "benchmarks/resilience/websocket/websocket-server.js"
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    }
  );

  child.stdout.on("data", data => {
    process.stdout.write(`[server] ${data}`);
  });

  child.stderr.on("data", data => {
    process.stderr.write(`[server] ${data}`);
  });

  child.on("error", error => {
    spawnFailures.push(error.message);
  });

  serverProcess = child;
}

async function stopServer() {
  const child = serverProcess;

  if (!child) return;

  serverProcess = null;

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const stopped = new Promise((resolve, reject) => {
    child.once("exit", resolve);
    child.once("error", reject);
  });

  child.kill("SIGKILL");

  await Promise.race([
    stopped,
    sleep(5000).then(() => {
      if (
        child.exitCode === null &&
        child.signalCode === null
      ) {
        throw new Error("WebSocket server did not stop");
      }
    })
  ]);
}

function createClients() {
  for (let index = 0; index < CLIENT_COUNT; index++) {
    const socket = io(BASE, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 100,
      reconnectionDelay: 200,
      reconnectionDelayMax: 500,
      timeout: 2000,
      forceNew: true,
      autoConnect: false
    });

    received.set(index, new Set());

    socket.on("connect", () => {
      socket.emit("join-match", matchId);
    });

    socket.on("connect_error", () => {
      // Expected while the server is unavailable.
    });

    socket.on("BALL_RECORDED", payload => {
      if (payload.matchId !== matchId) return;

      const eventId = payload.benchmarkEventId;

      if (typeof eventId !== "string") return;

      const seen = received.get(index);

      if (seen.has(eventId)) {
        duplicateDeliveries++;
        return;
      }

      seen.add(eventId);

      if (Number.isFinite(payload.benchmarkEmittedAt)) {
        deliveryLatencies.push(
          Math.max(
            0,
            Date.now() - payload.benchmarkEmittedAt
          )
        );
      }
    });

    clients.push(socket);
    socket.connect();
  }
}

function allReceived(eventId) {
  return clients.every((_, index) =>
    received.get(index).has(eventId)
  );
}

function publish(currentPhase) {
  const eventId = `${currentPhase}-${runId}-${sequence++}`;

  const started = performance.now();
  inFlight++;

  const operation = (async () => {
    let acknowledged = false;
    let status = 0;

    try {
      const response = await httpRequest("/emit", {
        matchId,
        eventId,
        payload: {
          inningsId: "traffic-innings",
          score: {
            runs: sequence,
            wickets: 2
          },
          updatedAt: new Date().toISOString()
        }
      });

      status = response.status;

      acknowledged =
        status === 200 &&
        response.body.eventId === eventId;

    } catch {
      // Expected connection failure during outage.
    } finally {
      records[currentPhase].push({
        eventId,
        status,
        acknowledged,
        latencyMs: Math.round(
          performance.now() - started
        )
      });

      inFlight--;
    }
  })();

  pending.add(operation);

  operation.finally(() => {
    pending.delete(operation);
  });
}

async function drain() {
  await waitFor(
    () => inFlight === 0,
    "pending publishing requests",
    10000
  );
}

async function runTrafficPhase(name, durationMs) {
  phase = name;

  await sleep(durationMs);

  // Pause new sends while requests finish.
  phase = "transition";

  await drain();
}

async function verifyDelivered(name) {
  const sent = records[name].filter(
    row => row.acknowledged
  );

  assert(
    sent.length >= 10,
    `Insufficient ${name} publishing traffic`
  );

  await waitFor(
    () => sent.every(row => allReceived(row.eventId)),
    `${name} delivery`,
    10000
  );

  return sent.length * CLIENT_COUNT;
}

async function main() {
  assertIsolation();

  assert.equal(
    await serverAvailable(),
    false,
    "WebSocket test port is already in use"
  );

  // Start actual CricZone benchmark server.
  startServer();

  await waitFor(
    serverAvailable,
    "initial WebSocket readiness"
  );

  createClients();

  await waitFor(
    () => clients.every(socket => socket.connected),
    "baseline client connections"
  );

  await waitFor(
    async () => (await roomCount()) === CLIENT_COUNT,
    "initial room membership"
  );

  // Keep producing events during the measured phases.
  timer = setInterval(() => {
    if (
      !["baseline", "outage", "recovery"].includes(phase)
    ) {
      return;
    }

    if (inFlight >= 2) return;

    publish(phase);
  }, 100);

  // Healthy baseline.
  await runTrafficPhase("baseline", 1800);

  const baselineDeliveries =
    await verifyDelivered("baseline");

  report.baselineHealthy =
    baselineDeliveries >= CLIENT_COUNT * 10;

  // Crash the server.
  const crashStartedAt = Date.now();

  await stopServer();

  await waitFor(
    () => clients.every(socket => !socket.connected),
    "client crash detection"
  );

  assert.equal(
    await serverAvailable(),
    false
  );

  report.serverCrashDetected = true;

  // Continue attempting HTTP event publishing.
  await runTrafficPhase("outage", 1800);

  assert(
    records.outage.length >= 10,
    "Insufficient outage publishing attempts"
  );

  report.outagePublishingRejected =
    records.outage.every(row => !row.acknowledged);

  assert.equal(
    report.outagePublishingRejected,
    true,
    "Publishing incorrectly succeeded while server offline"
  );

  // Restart the same benchmark server.
  const restartStartedAt = Date.now();

  startServer();

  await waitFor(
    serverAvailable,
    "restarted WebSocket readiness"
  );

  report.serverRestarted = true;

  await waitFor(
    () => clients.every(socket => socket.connected),
    "client reconnection",
    30000
  );

  report.clientsReconnected = true;

  await waitFor(
    async () => (await roomCount()) === CLIENT_COUNT,
    "room restoration",
    20000
  );

  report.roomSubscriptionsRestored = true;

  report.reconnectLatencyMs =
    Date.now() - restartStartedAt;

  // Verify sustained delivery after recovery.
  await runTrafficPhase("recovery", 2000);

  const recoveryDeliveries =
    await verifyDelivered("recovery");

  report.postRecoveryDelivered =
    recoveryDeliveries >= CLIENT_COUNT * 10;

  await sleep(250);

  report.duplicateDeliveries = duplicateDeliveries;

  assert.equal(
    duplicateDeliveries,
    0,
    "Duplicate WebSocket events detected"
  );

  for (const name of ["baseline", "recovery"]) {
    assert(
      records[name].every(row => row.acknowledged),
      `Unacknowledged publishing during ${name}`
    );
  }

  report.traffic.delivery = {
    baselineClientDeliveries: baselineDeliveries,
    recoveryClientDeliveries: recoveryDeliveries,
    p95DeliveryMs: percentile(
      deliveryLatencies,
      0.95
    )
  };

  report.traffic.crashDetectionMs =
    Date.now() - crashStartedAt -
    1800 -
    report.reconnectLatencyMs -
    2000;

  // Do not interpret the field above as a clean
  // crash-detection measurement: it is an approximate
  // elapsed-time calculation.
  delete report.traffic.crashDetectionMs;

  report.passed = [
    report.isolated,
    report.baselineHealthy,
    report.serverCrashDetected,
    report.outagePublishingRejected,
    report.serverRestarted,
    report.clientsReconnected,
    report.roomSubscriptionsRestored,
    report.postRecoveryDelivered,
    report.duplicateDeliveries === 0
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

  for (const socket of clients) {
    socket.disconnect();
    socket.removeAllListeners();
  }

  try {
    await stopServer();
  } catch (error) {
    report.failures.push(
      `Server cleanup: ${error.message}`
    );
  }

  report.duplicateDeliveries = duplicateDeliveries;

  for (const name of [
    "baseline",
    "outage",
    "recovery",
    "transition"
  ]) {
    report.traffic[name] = summarize(records[name]);
  }

  if (spawnFailures.length) {
    report.failures.push(...spawnFailures);
  }

  if (report.failures.length) {
    report.passed = false;
  }

  await mkdir(
    path.dirname(OUTPUT),
    { recursive: true }
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

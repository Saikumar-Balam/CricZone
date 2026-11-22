
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { io } from "socket.io-client";

const HOST = "127.0.0.1";
const PORT = 4005;
const BASE = `http://${HOST}:${PORT}`;
const CLIENT_COUNT = 5;
const runId = randomUUID();
const matchId = `restart-${runId}`;

const REPORT = path.resolve(
  "benchmarks/resilience/websocket/reports/restart.json"
);

const results = {
  phase: "25.7.4",
  scenario: "socketio_server_crash_restart",
  runId,
  clientCount: CLIENT_COUNT,
  baselineConnected: false,
  baselineRoomJoined: false,
  baselineDelivered: false,
  serverCrashDetected: false,
  serverRestarted: false,
  clientsReconnected: false,
  roomSubscriptionsRestored: false,
  postRestartDelivered: false,
  duplicateDeliveries: 0,
  failures: [],
  warnings: [
    "Room restoration requires clients to re-emit join-match.",
    "Events emitted while the server is offline are not replayed.",
    "This test uses one isolated server, not an ECS rolling deployment."
  ],
  passed: false
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitFor(check, label, timeout = 20000) {
  const end = Date.now() + timeout;

  while (Date.now() < end) {
    if (await check()) return;

    await sleep(100);
  }

  throw new Error(`${label} timed out`);
}

async function request(endpoint, body) {
  const response = await fetch(`${BASE}${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: {
      "content-type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(3000)
  });

  assert.equal(response.ok, true);

  return response.json();
}

async function available() {
  try {
    const health = await request("/health");
    return health.ok === true;
  } catch {
    return false;
  }
}

async function roomMembers() {
  const response = await request(
    `/rooms?matchId=${encodeURIComponent(matchId)}`
  );

  return response.members;
}

function assertIsolated() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.WS_BENCH_PORT, String(PORT));

  assert.equal(
    process.env.WS_BENCH_REDIS_URL,
    "redis://127.0.0.1:56380"
  );

  assert.equal(
    process.env.REDIS_URL,
    undefined,
    "Production Redis environment must not be configured"
  );
}

let serverProcess;
const clients = [];
const received = new Map();
let duplicates = 0;
let spawnErrors = [];

function startServer() {
  const child = spawn(
    process.execPath,
    ["benchmarks/resilience/websocket/websocket-server.js"],
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
    spawnErrors.push(error.message);
  });

  serverProcess = child;

  return child;
}

async function stopServer() {
  if (!serverProcess) return;

  const child = serverProcess;
  serverProcess = null;

  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = once(child, "exit");
  child.kill("SIGKILL");

  await Promise.race([
    exited,
    sleep(5000).then(() => {
      if (child.exitCode === null && child.signalCode === null) {
        throw new Error("Server did not exit after SIGKILL");
      }
    })
  ]);
}

async function emitEvent(eventId) {
  await request("/emit", {
    matchId,
    eventId,
    payload: {
      inningsId: "test-innings",
      score: {
        runs: 42,
        wickets: 2
      },
      updatedAt: new Date().toISOString()
    }
  });
}

function eventDeliveredToAll(eventId) {
  return clients.every((_, index) =>
    received.get(index)?.has(eventId)
  );
}

async function main() {
  assertIsolated();

  assert.equal(
    await available(),
    false,
    "Port 4005 must be unused before the test"
  );

  startServer();

  await waitFor(available, "initial server readiness");

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

    // Also executes after successful automatic reconnection.
    socket.on("connect", () => {
      socket.emit("join-match", matchId);
    });

    socket.on("connect_error", () => {
      // Expected while the benchmark server is offline.
    });

    socket.on("BALL_RECORDED", payload => {
      if (payload.matchId !== matchId) return;

      const id = payload.benchmarkEventId;
      if (typeof id !== "string") return;

      const seen = received.get(index);

      if (seen.has(id)) {
        duplicates++;
      } else {
        seen.add(id);
      }
    });

    clients.push(socket);
    socket.connect();
  }

  await waitFor(
    () => clients.every(socket => socket.connected),
    "baseline client connections"
  );

  results.baselineConnected = true;

  await waitFor(
    async () => (await roomMembers()) === CLIENT_COUNT,
    "baseline match-room membership"
  );

  results.baselineRoomJoined = true;

  const beforeId = `before-${runId}`;

  await emitEvent(beforeId);

  await waitFor(
    () => eventDeliveredToAll(beforeId),
    "baseline event delivery"
  );

  results.baselineDelivered = true;

  // Simulate an abrupt backend process crash.
  await stopServer();

  await waitFor(
    () => clients.every(socket => !socket.connected),
    "client outage detection"
  );

  results.serverCrashDetected = true;

  assert.equal(
    await available(),
    false,
    "Server must be unavailable after crash"
  );

  // Restart the same Socket.IO benchmark server.
  startServer();

  await waitFor(available, "restarted server readiness");

  results.serverRestarted = true;

  await waitFor(
    () => clients.every(socket => socket.connected),
    "automatic client reconnection",
    30000
  );

  results.clientsReconnected = true;

  // Socket.IO rooms are server-side and must be restored.
  await waitFor(
    async () => (await roomMembers()) === CLIENT_COUNT,
    "room resubscription after restart"
  );

  results.roomSubscriptionsRestored = true;

  const afterId = `after-${runId}`;

  await emitEvent(afterId);

  await waitFor(
    () => eventDeliveredToAll(afterId),
    "post-restart event delivery"
  );

  await sleep(300);

  results.duplicateDeliveries = duplicates;

  assert.equal(
    duplicates,
    0,
    "Unexpected duplicate WebSocket deliveries"
  );

  results.postRestartDelivered = true;

  results.passed = [
    results.baselineConnected,
    results.baselineRoomJoined,
    results.baselineDelivered,
    results.serverCrashDetected,
    results.serverRestarted,
    results.clientsReconnected,
    results.roomSubscriptionsRestored,
    results.postRestartDelivered
  ].every(Boolean);
}

try {
  await main();
} catch (error) {
  results.failures.push(error.stack || String(error));
} finally {
  for (const client of clients) {
    client.disconnect();
    client.removeAllListeners();
  }

  try {
    await stopServer();
  } catch (error) {
    results.failures.push(`cleanup: ${error.message}`);
  }

  if (spawnErrors.length > 0) {
    results.failures.push(...spawnErrors);
  }

  if (results.failures.length > 0) {
    results.passed = false;
  }

  await mkdir(path.dirname(REPORT), {
    recursive: true
  });

  await writeFile(
    REPORT,
    JSON.stringify(results, null, 2) + "\n"
  );

  console.log(JSON.stringify(results, null, 2));

  if (!results.passed) {
    process.exitCode = 1;
  }
}

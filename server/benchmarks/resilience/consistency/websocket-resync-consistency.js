
/**
 * CricZone Phase 25.7.6.3
 * WebSocket authoritative state resynchronization.
 *
 * Tests missed live events, reconnect, REST snapshot recovery,
 * new live events, and stale-event rejection.
 *
 * Real PostgreSQL, Valkey, Socket.IO, MatchService,
 * MatchController, and match router.
 *
 * Isolated GitHub Actions execution only.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import express from "express";
import pg from "pg";
import { io } from "socket.io-client";

import MatchService from "../../../src/services/MatchService.js";
import MatchController from "../../../src/controllers/MatchController.js";
import { createMatchRouter } from "../../../src/routes/match.routes.js";

const HOST = "127.0.0.1";
const WS_PORT = 4007;
const API_PORT = 4008;

const WS_BASE = `http://${HOST}:${WS_PORT}`;
const API_BASE = `http://${HOST}:${API_PORT}`;

const DB_URL =
  "postgresql://criczone_test:criczone_test_password@127.0.0.1:55435/criczone_resilience";

const REDIS_URL = "redis://127.0.0.1:56383";

const OUTPUT = path.resolve(
  "benchmarks/resilience/consistency/reports/websocket-resync.json"
);

const runId = randomUUID();
const matchId = String(
  970000000 + Math.floor(Math.random() * 10000000)
);

const report = {
  phase: "25.7.6.3",
  scenario: "websocket_authoritative_rest_resynchronization",
  runId,

  isolated: false,
  baselineDelivered: false,
  disconnectConfirmed: false,
  missedEventsConfirmed: false,
  authoritativeDatabasePreserved: false,
  clientReconnected: false,
  roomSubscriptionRestored: false,
  restSnapshotRecovered: false,
  newLiveEventDelivered: false,
  staleEventRejected: false,
  finalStateConsistent: false,

  baselineScore: null,
  recoveredScore: null,
  finalScore: null,

  missedEventCount: 0,
  staleEventsIgnored: 0,
  duplicateEventsIgnored: 0,

  failures: [],
  warnings: [
    "The test uses an isolated PostgreSQL match snapshot table.",
    "The REST route uses CricZone MatchService and MatchController with a test PostgreSQL repository.",
    "The client-side resynchronization logic is implemented in this benchmark, not verified in the production frontend.",
    "Socket.IO does not replay events emitted while the client is disconnected.",
    "This test does not simulate an AWS ECS deployment or Kafka delivery."
  ],
  passed: false
};

function verifyIsolation() {
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.equal(process.env.NODE_ENV, "test");

  assert.equal(
    process.env.TEST_DATABASE_URL,
    DB_URL
  );

  assert.equal(
    process.env.WS_BENCH_REDIS_URL,
    REDIS_URL
  );

  assert.equal(
    process.env.WS_BENCH_PORT,
    String(WS_PORT)
  );

  for (const variable of [
    "DATABASE_URL",
    "REDIS_URL",
    "KAFKA_BROKERS"
  ]) {
    assert.equal(
      process.env[variable],
      undefined,
      `${variable} must not be configured`
    );
  }

  report.isolated = true;
}

const pool = new pg.Pool({
  connectionString: DB_URL,
  ssl: false,
  max: 5,
  connectionTimeoutMillis: 3000,
  statement_timeout: 5000
});

pool.on("error", error => {
  report.failures.push(
    `PostgreSQL pool error: ${error.message}`
  );
});

let websocketProcess = null;
let apiServer = null;

const clients = new Set();

let receivedCount = 0;
let missedEvents = 0;
let staleEventsIgnored = 0;
let duplicateEventsIgnored = 0;

async function waitFor(
  predicate,
  label,
  timeoutMs = 15000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    await sleep(50);
  }

  throw new Error(`Timed out: ${label}`);
}

async function request(base, endpoint, options = {}) {
  const response = await fetch(
    `${base}${endpoint}`,
    {
      ...options,
      signal: AbortSignal.timeout(3000)
    }
  );

  return {
    status: response.status,
    body: await response.json()
  };
}

async function websocketReady() {
  try {
    const response = await request(
      WS_BASE,
      "/health"
    );

    return (
      response.status === 200 &&
      response.body.ok === true
    );
  } catch {
    return false;
  }
}

async function roomMembers() {
  const response = await request(
    WS_BASE,
    `/rooms?matchId=${encodeURIComponent(matchId)}`
  );

  assert.equal(response.status, 200);

  return response.body.members;
}

async function getDatabaseState() {
  const result = await pool.query(
    `SELECT
       id,
       version,
       runs,
       wickets
     FROM resilience_ws_matches
     WHERE id = $1`,
    [matchId]
  );

  assert.equal(result.rowCount, 1);

  const row = result.rows[0];

  return {
    matchId: String(row.id),
    version: Number(row.version),
    runs: Number(row.runs),
    wickets: Number(row.wickets)
  };
}

async function updateDatabase(
  version,
  runs,
  wickets
) {
  const result = await pool.query(
    `UPDATE resilience_ws_matches
     SET version = $2,
         runs = $3,
         wickets = $4
     WHERE id = $1
       AND version = $2 - 1
     RETURNING version`,
    [matchId, version, runs, wickets]
  );

  assert.equal(
    result.rowCount,
    1,
    `Expected sequential update to version ${version}`
  );
}

function createAuthoritativeApi() {
  /*
   * MatchService receives a real PostgreSQL-backed
   * test repository.
   *
   * Cache is disabled for this test so the REST
   * snapshot is fetched from PostgreSQL.
   */
  const matchRepository = {
    async findById(id) {
      const result = await pool.query(
        `SELECT
           id,
           version,
           runs,
           wickets
         FROM resilience_ws_matches
         WHERE id = $1`,
        [id]
      );

      if (!result.rowCount) {
        return null;
      }

      const row = result.rows[0];

      return {
        matchId: String(row.id),
        version: Number(row.version),
        runs: Number(row.runs),
        wickets: Number(row.wickets)
      };
    }
  };

  const cache = {
    async get() {
      return null;
    },

    async set() {
      // No cached copies in this test.
    }
  };

  const service = new MatchService(
    matchRepository,
    cache
  );

  const controller = new MatchController(
    service
  );

  const validationMiddleware = {
    handle(req, res, next) {
      if (!/^\d+$/.test(req.params.matchId)) {
        return res.status(400).json({
          success: false,
          error: "Invalid match ID"
        });
      }

      next();
    }
  };

  const scorecardController = {
    getScorecardByMatchId(req, res) {
      res.status(501).json({
        success: false,
        error: "Outside this benchmark"
      });
    }
  };

  const app = express();

  app.disable("x-powered-by");

  app.use(
    "/api/v1/matches",
    createMatchRouter(
      controller,
      validationMiddleware,
      scorecardController
    )
  );

  app.use((error, req, res, next) => {
    console.error(
      "Test REST API failure:",
      error.message
    );

    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  });

  return app;
}

async function startApi() {
  const app = createAuthoritativeApi();

  apiServer = createServer(app);

  await new Promise((resolve, reject) => {
    apiServer.once("error", reject);

    apiServer.listen(
      API_PORT,
      HOST,
      resolve
    );
  });
}

async function stopApi() {
  if (!apiServer) return;

  const server = apiServer;
  apiServer = null;

  server.closeAllConnections();

  await new Promise((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function startWebsocket() {
  assert.equal(websocketProcess, null);

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

  websocketProcess = child;

  child.stdout.on("data", data => {
    process.stdout.write(
      `[websocket] ${data}`
    );
  });

  child.stderr.on("data", data => {
    process.stderr.write(
      `[websocket] ${data}`
    );
  });

  child.on("error", error => {
    report.failures.push(
      `WebSocket process: ${error.message}`
    );
  });

  await waitFor(
    websocketReady,
    "WebSocket server readiness",
    20000
  );
}

async function stopWebsocket() {
  const child = websocketProcess;

  if (!child) return;

  websocketProcess = null;

  if (
    child.exitCode !== null ||
    child.signalCode !== null
  ) {
    return;
  }

  child.kill("SIGTERM");

  await Promise.race([
    new Promise(resolve => {
      child.once("exit", resolve);
    }),
    sleep(5000).then(() => {
      if (
        child.exitCode === null &&
        child.signalCode === null
      ) {
        child.kill("SIGKILL");
      }
    })
  ]);
}

async function fetchAuthoritativeSnapshot() {
  const response = await request(
    API_BASE,
    `/api/v1/matches/${matchId}`
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);

  const snapshot = response.body.data;

  assert.equal(snapshot.matchId, matchId);
  assert(Number.isSafeInteger(snapshot.version));

  return snapshot;
}

function createClient() {
  const socket = io(WS_BASE, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 3000,
    forceNew: true,
    autoConnect: false
  });

  clients.add(socket);

  const client = {
    socket,
    state: null,
    receivedEvents: [],
    seenEventIds: new Set(),

    applySnapshot(snapshot) {
      assert.equal(snapshot.matchId, matchId);

      if (
        this.state &&
        snapshot.version < this.state.version
      ) {
        staleEventsIgnored++;
        return false;
      }

      this.state = {
        matchId,
        version: snapshot.version,
        runs: snapshot.runs,
        wickets: snapshot.wickets
      };

      return true;
    },

    applyLiveEvent(payload) {
      if (
        !payload ||
        payload.matchId !== matchId ||
        !Number.isSafeInteger(payload.version)
      ) {
        return;
      }

      const eventId =
        payload.benchmarkEventId;

      if (
        typeof eventId === "string" &&
        this.seenEventIds.has(eventId)
      ) {
        duplicateEventsIgnored++;
        return;
      }

      if (typeof eventId === "string") {
        this.seenEventIds.add(eventId);
      }

      this.receivedEvents.push({
        eventId,
        version: payload.version
      });

      receivedCount++;

      // Do not overwrite a newer authoritative state.
      if (
        this.state &&
        payload.version <= this.state.version
      ) {
        staleEventsIgnored++;
        return;
      }

      // Detect a missed version instead of silently
      // accepting a possibly incomplete event stream.
      if (
        this.state &&
        payload.version > this.state.version + 1
      ) {
        missedEvents +=
          payload.version - this.state.version - 1;

        return;
      }

      this.applySnapshot(payload);
    }
  };

  socket.on(
    "BALL_RECORDED",
    payload => client.applyLiveEvent(payload)
  );

  return client;
}

async function connectClient(client) {
  const { socket } = client;

  socket.connect();

  await waitFor(
    () => socket.connected,
    "Socket.IO client connection"
  );

  socket.emit("join-match", matchId);

  await waitFor(
    async () => (await roomMembers()) === 1,
    "Socket.IO room membership"
  );
}

async function disconnectClient(client) {
  client.socket.disconnect();

  await waitFor(
    () => !client.socket.connected,
    "Socket.IO client disconnect"
  );

  await waitFor(
    async () => (await roomMembers()) === 0,
    "Socket.IO room removal"
  );
}

async function emitLiveEvent(
  eventId,
  snapshot
) {
  const response = await request(
    WS_BASE,
    "/emit",
    {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        matchId,
        eventId,
        payload: snapshot
      })
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.eventId, eventId);
}

async function publishCommittedScore(
  version,
  runs,
  wickets
) {
  // The database commit happens before publication.
  await updateDatabase(
    version,
    runs,
    wickets
  );

  const snapshot = await getDatabaseState();

  await emitLiveEvent(
    `score-v${version}-${runId}`,
    snapshot
  );

  return snapshot;
}

async function assertState(
  state,
  version,
  runs,
  wickets
) {
  assert(state);

  assert.equal(state.matchId, matchId);
  assert.equal(state.version, version);
  assert.equal(state.runs, runs);
  assert.equal(state.wickets, wickets);
}

async function main() {
  verifyIsolation();

  await pool.query("SELECT 1");

  await pool.query(`
    CREATE TABLE resilience_ws_matches (
      id BIGINT PRIMARY KEY,
      version INTEGER NOT NULL,
      runs INTEGER NOT NULL,
      wickets INTEGER NOT NULL
    )
  `);

  await pool.query(
    `INSERT INTO resilience_ws_matches
       (id, version, runs, wickets)
     VALUES ($1, 1, 10, 1)`,
    [matchId]
  );

  await startApi();
  await startWebsocket();

  const viewer = createClient();

  await connectClient(viewer);

  // Baseline authoritative state.
  const baseline =
    await fetchAuthoritativeSnapshot();

  viewer.applySnapshot(baseline);

  await assertState(
    viewer.state,
    1,
    10,
    1
  );

  report.baselineScore = baseline;

  // Confirm live updates work before disconnect.
  await publishCommittedScore(
    2,
    12,
    1
  );

  await waitFor(
    () => viewer.state?.version === 2,
    "baseline live event"
  );

  await assertState(
    viewer.state,
    2,
    12,
    1
  );

  report.baselineDelivered = true;

  // Disconnect the client while leaving the server
  // and PostgreSQL running.
  await disconnectClient(viewer);

  report.disconnectConfirmed = true;

  const eventsBeforeOutage =
    viewer.receivedEvents.length;

  // These updates are deliberately missed by the
  // disconnected client.
  await publishCommittedScore(
    3,
    16,
    1
  );

  await publishCommittedScore(
    4,
    18,
    1
  );

  await sleep(200);

  assert.equal(
    viewer.receivedEvents.length,
    eventsBeforeOutage,
    "Disconnected client received an event"
  );

  await assertState(
    viewer.state,
    2,
    12,
    1
  );

  report.missedEventCount = 2;
  report.missedEventsConfirmed = true;

  const databaseState =
    await getDatabaseState();

  await assertState(
    databaseState,
    4,
    18,
    1
  );

  report.authoritativeDatabasePreserved = true;

  // Create a fresh connection to model a reconnect.
  const recoveredViewer = createClient();

  await connectClient(recoveredViewer);

  report.clientReconnected = true;

  assert.equal(
    await roomMembers(),
    1
  );

  report.roomSubscriptionRestored = true;

  // REST is authoritative after reconnect.
  const recoveredSnapshot =
    await fetchAuthoritativeSnapshot();

  recoveredViewer.applySnapshot(
    recoveredSnapshot
  );

  await assertState(
    recoveredViewer.state,
    4,
    18,
    1
  );

  report.recoveredScore = recoveredSnapshot;
  report.restSnapshotRecovered = true;

  // A genuine new event must still be delivered.
  await publishCommittedScore(
    5,
    22,
    1
  );

  await waitFor(
    () => recoveredViewer.state?.version === 5,
    "post-reconnect live score"
  );

  await assertState(
    recoveredViewer.state,
    5,
    22,
    1
  );

  report.newLiveEventDelivered = true;

  // Inject an older event into the same room.
  // The authoritative PostgreSQL state is NOT changed.
  await emitLiveEvent(
    `delayed-v3-${runId}`,
    {
      matchId,
      version: 3,
      runs: 16,
      wickets: 1
    }
  );

  await waitFor(
    () =>
      recoveredViewer.receivedEvents.some(
        event =>
          event.eventId ===
          `delayed-v3-${runId}`
      ),
    "delayed stale event delivery"
  );

  await assertState(
    recoveredViewer.state,
    5,
    22,
    1
  );

  assert(staleEventsIgnored >= 1);

  report.staleEventRejected = true;

  // Final REST/PG/client reconciliation.
  const finalDatabaseState =
    await getDatabaseState();

  const finalRestSnapshot =
    await fetchAuthoritativeSnapshot();

  assert.deepEqual(
    finalRestSnapshot,
    finalDatabaseState
  );

  assert.deepEqual(
    recoveredViewer.state,
    finalDatabaseState
  );

  report.finalStateConsistent = true;
  report.finalScore = finalDatabaseState;

  report.staleEventsIgnored =
    staleEventsIgnored;

  report.duplicateEventsIgnored =
    duplicateEventsIgnored;

  report.passed = [
    report.isolated,
    report.baselineDelivered,
    report.disconnectConfirmed,
    report.missedEventsConfirmed,
    report.authoritativeDatabasePreserved,
    report.clientReconnected,
    report.roomSubscriptionRestored,
    report.restSnapshotRecovered,
    report.newLiveEventDelivered,
    report.staleEventRejected,
    report.finalStateConsistent
  ].every(Boolean);
}

try {
  await main();

} catch (error) {
  report.failures.push(
    error.stack ?? String(error)
  );

} finally {
  for (const socket of clients) {
    socket.disconnect();
    socket.removeAllListeners();
  }

  const cleanup = await Promise.allSettled([
    stopWebsocket(),
    stopApi(),
    pool.end()
  ]);

  for (const outcome of cleanup) {
    if (outcome.status === "rejected") {
      report.failures.push(
        `Cleanup: ${outcome.reason?.message ??
          outcome.reason}`
      );
    }
  }

  report.staleEventsIgnored =
    staleEventsIgnored;

  report.duplicateEventsIgnored =
    duplicateEventsIgnored;

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

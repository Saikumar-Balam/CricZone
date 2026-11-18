
import { io as connect } from "socket.io-client";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

// ============================================================
// STEP 25.6.8 — AUTOMATED WEBSOCKET BENCHMARK MATRIX
// ============================================================

const HOST = "127.0.0.1";

const MAIN = Number(process.env.WS_BENCH_PORT || 4005);
const SECOND = Number(process.env.WS_BENCH_SECOND_PORT || 4006);

const ROOT = `http://${HOST}:${MAIN}`;
const OTHER = `http://${HOST}:${SECOND}`;

const OUT = path.resolve(
  "benchmarks/websocket/websocket-results"
);

const REPEATS = Number(process.env.WS_BENCH_REPEATS || 3);

const SELECTED_SCENARIO = process.env.WS_BENCH_SCENARIO;
const SELECTED_RUN = process.env.WS_BENCH_RUN;

const CONNECT_TIMEOUT = 12000;
const WAIT_TIMEOUT = 15000;

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// STATISTICAL UTILITIES
// ============================================================

function percentile(values, p) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);

  const index = Math.max(
    0,
    Math.ceil(sorted.length * p / 100) - 1
  );

  return sorted[index];
}


function stats(values) {
  if (values.length === 0) {
    return {
      samples: 0,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  const getPercentile = p => {
    const index = Math.max(
      0,
      Math.ceil(sorted.length * p / 100) - 1
    );

    return sorted[index];
  };

  return {
    samples: values.length,
    p50Ms: getPercentile(50),
    p95Ms: getPercentile(95),
    p99Ms: getPercentile(99),
    maxMs: sorted[sorted.length - 1]
  };
}


function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// ============================================================
// HTTP BENCHMARK CONTROL CLIENT
// ============================================================

async function api(base, endpoint, body) {
  const response = await fetch(base + endpoint, {
    ...(body === undefined
      ? {}
      : {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(body)
        })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `${endpoint}: ${response.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

// ============================================================
// SOCKET.IO CLIENT FACTORY
// ============================================================

function socket(base = ROOT) {
  return connect(base, {
    transports: ["websocket"],
    autoConnect: false,
    reconnection: false,
    forceNew: true,
    timeout: CONNECT_TIMEOUT
  });
}

function connectOne(client) {
  return new Promise(resolve => {
    const start = performance.now();

    let completed = false;

    const finish = (success, error = null) => {
      if (completed) return;

      completed = true;

      clearTimeout(timer);

      client.off("connect", onConnect);
      client.off("connect_error", onError);

      resolve({
        success,
        latencyMs: performance.now() - start,
        error
      });
    };

    const onConnect = () => finish(true);

    const onError = error =>
      finish(false, error.message);

    const timer = setTimeout(
      () => finish(false, "connection timeout"),
      CONNECT_TIMEOUT
    );

    client.once("connect", onConnect);
    client.once("connect_error", onError);

    client.connect();
  });
}

// ============================================================
// CONCURRENT CLIENT POOL
// ============================================================

async function pool(count, base = ROOT) {
  const sockets = [];
  const latencies = [];
  const errors = [];

  const batchSize = 50;

  for (let i = 0; i < count; i += batchSize) {
    const batch = Array.from(
      {
        length: Math.min(batchSize, count - i)
      },
      () => socket(base)
    );

    const outcomes = await Promise.all(
      batch.map(connectOne)
    );

    outcomes.forEach((outcome, index) => {
      if (outcome.success) {
        sockets.push(batch[index]);
        latencies.push(outcome.latencyMs);
      } else {
        errors.push(outcome.error);
        batch[index].disconnect();
      }
    });

    if (i + batchSize < count) {
      await sleep(100);
    }
  }

  return {
    sockets,
    latencies,
    errors
  };
}

async function close(sockets) {
  sockets.forEach(client => client.disconnect());

  await sleep(200);
}

// ============================================================
// POLLING AND ROOM MEMBERSHIP
// ============================================================

async function waitFor(
  check,
  description,
  timeout = WAIT_TIMEOUT
) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }

    await sleep(50);
  }

  throw new Error(`Timed out: ${description}`);
}

async function roomCount(base, matchId) {
  const result = await api(
    base,
    `/rooms?matchId=${encodeURIComponent(matchId)}`
  );

  return result.members;
}

async function join(sockets, matchId, base = ROOT) {
  sockets.forEach(client => {
    client.emit("join-match", matchId);
  });

  await waitFor(
    async () =>
      (await roomCount(base, matchId)) === sockets.length,
    `room ${matchId} membership`
  );
}

// ============================================================
// CRICKET EVENT PAYLOAD
// ============================================================

function samplePayload(eventId) {
  return {
    inningsId: "bench-innings",
    inningsNumber: 1,

    score: {
      runs: 1,
      wickets: 0,
      legalBalls: 1,
      extras: 0
    },

    lastDelivery: {
      deliveryId: eventId,
      overNumber: 0,
      ballNumber: 1,
      batsmanRuns: 1,
      extraRuns: 0,
      totalRuns: 1,
      wicket: false,
      four: false,
      six: false
    },

    inningsCompleted: false,
    completionReason: null,
    updatedAt: new Date().toISOString()
  };
}

async function emit(base, matchId, eventId) {
  return api(base, "/emit", {
    matchId,
    eventId,
    payload: samplePayload(eventId)
  });
}

// ============================================================
// EVENT DELIVERY TRACKER
// ============================================================

function tracker(sockets, expectedRoom, prefix) {
  const seen = new Set();
  const latencies = [];

  let duplicates = 0;
  let foreign = 0;
  let malformed = 0;

  sockets.forEach((client, index) => {
    client.on("BALL_RECORDED", payload => {
      if (
        !payload ||
        typeof payload.benchmarkEventId !== "string" ||
        typeof payload.benchmarkEmittedAt !== "number"
      ) {
        malformed++;
        return;
      }

      if (
        payload.matchId !== expectedRoom ||
        !payload.benchmarkEventId.startsWith(prefix)
      ) {
        foreign++;
        return;
      }

      const key = `${index}:${payload.benchmarkEventId}`;

      if (seen.has(key)) {
        duplicates++;
        return;
      }

      seen.add(key);

      latencies.push(
        Math.max(
          0,
          Date.now() - payload.benchmarkEmittedAt
        )
      );
    });
  });

  return {
    seen,
    latencies,

    get duplicates() {
      return duplicates;
    },

    get foreign() {
      return foreign;
    },

    get malformed() {
      return malformed;
    }
  };
}

async function collect(trackerResult, expected) {
  await waitFor(
    () => trackerResult.seen.size >= expected,
    "broadcast delivery",
    8000
  ).catch(() => {});

  await sleep(150);

  return {
    expectedDeliveries: expected,
    receivedDeliveries: trackerResult.seen.size,

    deliveryRate: rate(
      trackerResult.seen.size,
      expected
    ),

    duplicates: trackerResult.duplicates,
    foreignDeliveries: trackerResult.foreign,
    malformedDeliveries: trackerResult.malformed,

    latency: stats(trackerResult.latencies)
  };
}

// ============================================================
// 25.6.8.1–25.6.8.3
// CONCURRENT CONNECTION BENCHMARKS
// ============================================================

async function connections(count, repetition) {
  const clients = await pool(count);

  try {
    const snapshot = await api(ROOT, "/stats");

    const successRate = rate(
      clients.sockets.length,
      count
    );

    return {
      attempted: count,
      connected: clients.sockets.length,
      failed: clients.errors.length,
      successRate,

      latency: stats(clients.latencies),
      memory: snapshot.memory,

      errors: clients.errors.slice(0, 10),

      pass: successRate >= 0.99
    };
  } finally {
    await close(clients.sockets);
  }
}

// ============================================================
// 25.6.8.4
// ROOM SUBSCRIPTION BENCHMARK
// ============================================================

async function subscriptions(repetition) {
  const matchId = `sub-${repetition}`;

  const clients = await pool(500);

  try {
    assert(
      clients.sockets.length === 500,
      "500 connected clients required"
    );

    await join(clients.sockets, matchId);

    const joined = await roomCount(ROOT, matchId);

    clients.sockets.forEach(client => {
      client.emit("leave-match", matchId);
    });

    await waitFor(
      async () =>
        (await roomCount(ROOT, matchId)) === 0,
      "room leave"
    );

    const remaining = await roomCount(ROOT, matchId);

    return {
      clients: 500,
      joined,
      left: joined - remaining,
      remaining,

      pass:
        joined === 500 &&
        remaining === 0
    };
  } finally {
    await close(clients.sockets);
  }
}

// ============================================================
// 25.6.8.5
// SINGLE-MATCH BROADCAST BENCHMARK
// ============================================================

async function broadcast(repetition) {
  const matchId = `broadcast-${repetition}`;

  const clients = await pool(500);

  try {
    assert(
      clients.sockets.length === 500,
      "500 connected clients required"
    );

    const t = tracker(
      clients.sockets,
      matchId,
      `b${repetition}-`
    );

    await join(clients.sockets, matchId);

    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      await emit(
        ROOT,
        matchId,
        `b${repetition}-${i}`
      );
    }

    const elapsed =
      (performance.now() - start) / 1000;

    const result = await collect(t, 50000);

    return {
      clients: 500,
      emittedEvents: 100,
      durationSeconds: elapsed,

      eventsPerSecond: 100 / elapsed,

      ...result,

      pass:
        result.deliveryRate >= 0.999 &&
        result.duplicates === 0 &&
        result.foreignDeliveries === 0 &&
        result.malformedDeliveries === 0
    };
  } finally {
    await close(clients.sockets);
  }
}

// ============================================================
// 25.6.8.6
// MULTI-MATCH ROOM ISOLATION BENCHMARK
// ============================================================

async function multiroom(repetition) {
  const clients = await pool(1000);

  try {
    assert(
      clients.sockets.length === 1000,
      "1000 connected clients required"
    );

    const rooms = Array.from(
      { length: 10 },
      (_, index) => `multi-${repetition}-${index}`
    );

    const trackers = [];

    for (let i = 0; i < 10; i++) {
      const group = clients.sockets.slice(
        i * 100,
        (i + 1) * 100
      );

      trackers.push(
        tracker(
          group,
          rooms[i],
          `m${repetition}-`
        )
      );

      await join(group, rooms[i]);
    }

    for (let i = 0; i < 10; i++) {
      for (let event = 0; event < 10; event++) {
        await emit(
          ROOT,
          rooms[i],
          `m${repetition}-${i}-${event}`
        );
      }
    }

    await sleep(1500);

    const results = trackers.map(t => ({
      received: t.seen.size,
      duplicates: t.duplicates,
      foreign: t.foreign,
      malformed: t.malformed
    }));

    const received = results.reduce(
      (sum, r) => sum + r.received,
      0
    );

    const foreign = results.reduce(
      (sum, r) => sum + r.foreign,
      0
    );

    const duplicates = results.reduce(
      (sum, r) => sum + r.duplicates,
      0
    );

    const malformed = results.reduce(
      (sum, r) => sum + r.malformed,
      0
    );

    const expected = 10000;

    return {
      rooms: 10,
      clients: 1000,
      emittedEvents: 100,

      expectedDeliveries: expected,
      receivedDeliveries: received,
      deliveryRate: rate(received, expected),

      foreignDeliveries: foreign,
      duplicates,
      malformedDeliveries: malformed,

      pass:
        received >= 9990 &&
        foreign === 0 &&
        duplicates === 0 &&
        malformed === 0
    };
  } finally {
    await close(clients.sockets);
  }
}

// ============================================================
// 25.6.8.7
// SUSTAINED BROADCAST THROUGHPUT BENCHMARK
// ============================================================

async function sustained(repetition) {
  const matchId = `sustain-${repetition}`;

  const clients = await pool(500);

  try {
    assert(
      clients.sockets.length === 500,
      "500 connected clients required"
    );

    const t = tracker(
      clients.sockets,
      matchId,
      `s${repetition}-`
    );

    await join(clients.sockets, matchId);

    const start = performance.now();

    // 600 events at a nominal rate of 10 events/sec.
    for (let i = 0; i < 600; i++) {
      const target = start + i * 100;

      const delay = target - performance.now();

      if (delay > 0) {
        await sleep(delay);
      }

      await emit(
        ROOT,
        matchId,
        `s${repetition}-${i}`
      );
    }

    const elapsed =
      (performance.now() - start) / 1000;

    const result = await collect(t, 300000);

    return {
      clients: 500,
      emittedEvents: 600,
      durationSeconds: elapsed,

      eventsPerSecond: 600 / elapsed,

      deliveriesPerSecond:
        result.receivedDeliveries / elapsed,

      ...result,

      pass:
        result.deliveryRate >= 0.999 &&
        result.duplicates === 0 &&
        result.foreignDeliveries === 0 &&
        result.malformedDeliveries === 0
    };
  } finally {
    await close(clients.sockets);
  }
}

// ============================================================
// 25.6.8.8
// DISCONNECT AND RECONNECT BENCHMARK
// ============================================================

async function reconnect(repetition) {
  const matchId = `reconnect-${repetition}`;

  let clients = await pool(500);

  try {
    assert(
      clients.sockets.length === 500,
      "Initial 500 connections failed"
    );

    await join(clients.sockets, matchId);

    await close(clients.sockets);

    await waitFor(
      async () =>
        (await roomCount(ROOT, matchId)) === 0,
      "room cleanup after disconnect"
    );

    // Re-establish 500 new Socket.IO connections.
    clients = await pool(500);

    assert(
      clients.sockets.length === 500,
      "Reconnection of 500 clients failed"
    );

    const t = tracker(
      clients.sockets,
      matchId,
      `r${repetition}-`
    );

    await join(clients.sockets, matchId);

    await emit(
      ROOT,
      matchId,
      `r${repetition}-0`
    );

    const result = await collect(t, 500);

    return {
      attemptedReconnects: 500,
      reconnected: clients.sockets.length,

      ...result,

      pass:
        result.receivedDeliveries === 500 &&
        result.duplicates === 0 &&
        result.foreignDeliveries === 0
    };
  } finally {
    await close(clients.sockets);
  }
}

// ============================================================
// 25.6.8.9
// INVALID SUBSCRIPTION BENCHMARK
// ============================================================

async function invalid(repetition) {
  const clients = await pool(10);

  try {
    assert(
      clients.sockets.length === 10,
      "10 connected clients required"
    );

    const invalidIds = [
      "",
      " ",
      null,
      123
    ];

    for (const client of clients.sockets) {
      for (const invalidId of invalidIds) {
        client.emit("join-match", invalidId);
      }
    }

    await sleep(300);

    // The server's /rooms endpoint rejects blank IDs.
    // Check nonblank invalid identifiers separately.
    const memberships = await Promise.all(
      ["null", "123"].map(matchId =>
        roomCount(ROOT, matchId)
      )
    );

    const unexpectedRoomMembers = memberships.reduce(
      (sum, count) => sum + count,
      0
    );

    return {
      clients: 10,
      invalidEmits: 40,
      unexpectedRoomMembers,

      pass: unexpectedRoomMembers === 0
    };
  } finally {
    await close(clients.sockets);
  }
}

// ============================================================
// 25.6.8.10
// CROSS-INSTANCE REDIS ADAPTER BROADCAST BENCHMARK
// ============================================================

async function crossInstance(repetition) {
  const matchId = `cross-${repetition}`;

  const a = await pool(100, ROOT);
  const b = await pool(100, OTHER);

  try {
    assert(
      a.sockets.length === 100 &&
      b.sockets.length === 100,
      "Both Socket.IO instances require 100 clients"
    );

    const ta = tracker(
      a.sockets,
      matchId,
      `x${repetition}-`
    );

    const tb = tracker(
      b.sockets,
      matchId,
      `x${repetition}-`
    );

    await join(a.sockets, matchId, ROOT);
    await join(b.sockets, matchId, OTHER);

    await emit(
      ROOT,
      matchId,
      `x${repetition}-0`
    );

    await emit(
      OTHER,
      matchId,
      `x${repetition}-1`
    );

    await sleep(1000);

    const received =
      ta.seen.size + tb.seen.size;

    const duplicates =
      ta.duplicates + tb.duplicates;

    const foreign =
      ta.foreign + tb.foreign;

    const malformed =
      ta.malformed + tb.malformed;

    return {
      instances: 2,
      clientsPerInstance: 100,
      totalClients: 200,
      emittedEvents: 2,

      expectedDeliveries: 400,
      receivedDeliveries: received,
      deliveryRate: rate(received, 400),

      duplicates,
      foreignDeliveries: foreign,
      malformedDeliveries: malformed,

      pass:
        received === 400 &&
        duplicates === 0 &&
        foreign === 0 &&
        malformed === 0
    };
  } finally {
    await close([
      ...a.sockets,
      ...b.sockets
    ]);
  }
}

// ============================================================
// MATRIX SCENARIO REGISTRY
// ============================================================

const scenarios = new Map([
  [
    "connections-100",
    rep => connections(100, rep)
  ],
  [
    "connections-500",
    rep => connections(500, rep)
  ],
  [
    "connections-1000",
    rep => connections(1000, rep)
  ],
  [
    "subscriptions",
    subscriptions
  ],
  [
    "broadcast",
    broadcast
  ],
  [
    "multiroom",
    multiroom
  ],
  [
    "sustained",
    sustained
  ],
  [
    "reconnect",
    reconnect
  ],
  [
    "invalid",
    invalid
  ],
  [
    "cross-instance",
    crossInstance
  ]
]);

// ============================================================
// VALIDATE GITHUB ACTIONS MATRIX INPUTS
// ============================================================

if (
  !Number.isInteger(REPEATS) ||
  REPEATS < 1
) {
  throw new Error(
    `Invalid WS_BENCH_REPEATS: ${REPEATS}`
  );
}

if (
  SELECTED_SCENARIO &&
  !scenarios.has(SELECTED_SCENARIO)
) {
  throw new Error(
    `Unknown WebSocket scenario: ${SELECTED_SCENARIO}`
  );
}

if (
  SELECTED_RUN !== undefined &&
  (
    !/^[1-9]\d*$/.test(SELECTED_RUN) ||
    Number(SELECTED_RUN) > REPEATS
  )
) {
  throw new Error(
    `Invalid WS_BENCH_RUN: ${SELECTED_RUN}`
  );
}

if (SELECTED_RUN && !SELECTED_SCENARIO) {
  throw new Error(
    "WS_BENCH_RUN requires WS_BENCH_SCENARIO"
  );
}

// ============================================================
// AUTOMATED MATRIX EXECUTION
// ============================================================

await fs.mkdir(OUT, {
  recursive: true
});

const selectedScenarios = SELECTED_SCENARIO
  ? [
      [
        SELECTED_SCENARIO,
        scenarios.get(SELECTED_SCENARIO)
      ]
    ]
  : [...scenarios.entries()];

const all = [];

for (const [name, scenario] of selectedScenarios) {
  const runs = SELECTED_RUN
    ? [Number(SELECTED_RUN)]
    : Array.from(
        { length: REPEATS },
        (_, index) => index + 1
      );

  for (const repetition of runs) {
    console.log(
      "=================================================="
    );

    console.log(
      `START: ${name} | Run ${repetition}/${REPEATS}`
    );

    console.log(
      "=================================================="
    );

    const startedAt = performance.now();

    let result;

    try {
      result = await scenario(repetition);
    } catch (error) {
      result = {
        pass: false,
        error: error.stack || String(error)
      };
    }

    const elapsedMs =
      performance.now() - startedAt;

    const record = {
      scenario: name,
      repetition,
      timestamp: new Date().toISOString(),
      executionTimeMs: elapsedMs,
      ...result
    };

    all.push(record);

    const filename =
      `${name}-run-${repetition}.json`;

    await fs.writeFile(
      path.join(OUT, filename),
      JSON.stringify(record, null, 2),
      "utf8"
    );

    console.log(
      `${record.pass ? "PASS" : "FAIL"}: ` +
      `${name} | Run ${repetition}`
    );

    console.log(
      JSON.stringify(record, null, 2)
    );

    await sleep(400);
  }
}

// ============================================================
// JSON SUMMARY REPORT
// ============================================================

const passed = all.filter(
  result => result.pass === true
).length;

const failed = all.length - passed;

const summary = {
  benchmark: "CricZone WebSocket Performance",
  step: "25.6.8",

  selectedScenario: SELECTED_SCENARIO || "all",
  selectedRun: SELECTED_RUN
    ? Number(SELECTED_RUN)
    : "all",

  totalScenarios: scenarios.size,
  configuredRepetitions: REPEATS,

  executedRuns: all.length,
  passed,
  failed,

  successRate: rate(passed, all.length),

  results: all
};

await fs.writeFile(
  path.join(OUT, "summary.json"),
  JSON.stringify(summary, null, 2),
  "utf8"
);

console.log(
  "=================================================="
);

console.log("WEBSOCKET BENCHMARK SUMMARY");

console.log(
  `Executed: ${summary.executedRuns}`
);

console.log(
  `Passed: ${summary.passed}`
);

console.log(
  `Failed: ${summary.failed}`
);

console.log(
  "=================================================="
);

if (failed > 0) {
  process.exitCode = 1;
}

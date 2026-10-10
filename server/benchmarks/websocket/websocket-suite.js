
import { io as connect } from "socket.io-client";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

const HOST = "127.0.0.1";
const MAIN = Number(process.env.WS_BENCH_PORT || 4005);
const SECOND = Number(process.env.WS_BENCH_SECOND_PORT || 4006);

const ROOT = `http://${HOST}:${MAIN}`;
const OTHER = `http://${HOST}:${SECOND}`;

const OUT = path.resolve(
    "benchmarks/websocket/websocket-results"
);

const REPEATS = Number(process.env.WS_BENCH_REPEATS || 3);
const CONNECT_TIMEOUT = 12000;
const WAIT_TIMEOUT = 15000;

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

const percentile = (values, p) =>
    values.length
        ? [...values].sort((a, b) => a - b)[
              Math.max(0, Math.ceil(values.length * p / 100) - 1)
          ]
        : null;

const stats = values => ({
    samples: values.length,
    p50Ms: percentile(values, 50),
    p95Ms: percentile(values, 95),
    p99Ms: percentile(values, 99),
    maxMs: values.length ? Math.max(...values) : null
});

const rate = (numerator, denominator) =>
    denominator ? numerator / denominator : 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function api(base, endpoint, body) {
    const response = await fetch(
        base + endpoint,
        body === undefined
            ? {}
            : {
                  method: "POST",
                  headers: {
                      "content-type": "application/json"
                  },
                  body: JSON.stringify(body)
              }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            `${endpoint}: ${response.status} ${JSON.stringify(data)}`
        );
    }

    return data;
}

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
        let done = false;

        const finish = (success, error) => {
            if (done) return;
            done = true;

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
            () => finish(false, "timeout"),
            CONNECT_TIMEOUT
        );

        client.once("connect", onConnect);
        client.once("connect_error", onError);
        client.connect();
    });
}

async function pool(count, base = ROOT) {
    const sockets = [];
    const latencies = [];
    const errors = [];

    for (let i = 0; i < count; i += 50) {
        const batch = Array.from(
            { length: Math.min(50, count - i) },
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

        if (i + 50 < count) {
            await sleep(100);
        }
    }

    return { sockets, latencies, errors };
}

async function close(sockets) {
    sockets.forEach(client => client.disconnect());
    await sleep(200);
}

async function waitFor(
    check,
    description,
    timeout = WAIT_TIMEOUT
) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if (await check()) return;
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
    await api(base, "/emit", {
        matchId,
        eventId,
        payload: samplePayload(eventId)
    });
}

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

            const key =
                `${index}:${payload.benchmarkEventId}`;

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

// 25.6.8.1–25.6.8.3
async function connections(count, repetition) {
    const clients = await pool(count);

    try {
        const snapshot = await api(ROOT, "/stats");

        return {
            attempted: count,
            connected: clients.sockets.length,
            failed: clients.errors.length,
            successRate: rate(
                clients.sockets.length,
                count
            ),
            latency: stats(clients.latencies),
            memory: snapshot.memory,
            errors: clients.errors.slice(0, 10),
            pass:
                clients.sockets.length / count >= 0.99
        };
    } finally {
        await close(clients.sockets);
    }
}

// 25.6.8.4
async function subscriptions(repetition) {
    const matchId = `sub-${repetition}`;
    const clients = await pool(500);

    try {
        assert(
            clients.sockets.length === 500,
            "500 clients required"
        );

        await join(clients.sockets, matchId);

        const before = await roomCount(ROOT, matchId);

        clients.sockets.forEach(client => {
            client.emit("leave-match", matchId);
        });

        await waitFor(
            async () =>
                (await roomCount(ROOT, matchId)) === 0,
            "room leave"
        );

        return {
            joined: before,
            left: 500,
            remaining: await roomCount(ROOT, matchId),
            pass: before === 500
        };
    } finally {
        await close(clients.sockets);
    }
}

// 25.6.8.5
async function broadcast(repetition) {
    const matchId = `broadcast-${repetition}`;
    const clients = await pool(500);

    try {
        assert(
            clients.sockets.length === 500,
            "500 clients required"
        );

        const t = tracker(
            clients.sockets,
            matchId,
            `b${repetition}-`
        );

        await join(clients.sockets, matchId);

        for (let i = 0; i < 100; i++) {
            await emit(
                ROOT,
                matchId,
                `b${repetition}-${i}`
            );
        }

        const result = await collect(t, 50000);

        return {
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

// 25.6.8.6
async function multiroom(repetition) {
    const clients = await pool(1000);

    try {
        assert(
            clients.sockets.length === 1000,
            "1000 clients required"
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

        return {
            rooms: 10,
            clients: 1000,
            expectedDeliveries: 10000,
            receivedDeliveries: received,
            deliveryRate: rate(received, 10000),
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

// 25.6.8.7
async function sustained(repetition) {
    const matchId = `sustain-${repetition}`;
    const clients = await pool(500);

    try {
        assert(
            clients.sockets.length === 500,
            "500 clients required"
        );

        const t = tracker(
            clients.sockets,
            matchId,
            `s${repetition}-`
        );

        await join(clients.sockets, matchId);

        const start = performance.now();

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
            ...result,
            durationSeconds: elapsed,
            emittedEvents: 600,
            eventsPerSecond: 600 / elapsed,
            deliveriesPerSecond:
                result.receivedDeliveries / elapsed,

            pass:
                result.deliveryRate >= 0.999 &&
                result.duplicates === 0 &&
                result.foreignDeliveries === 0
        };
    } finally {
        await close(clients.sockets);
    }
}

// 25.6.8.8
async function reconnect(repetition) {
    const matchId = `reconnect-${repetition}`;

    let clients = await pool(500);

    try {
        assert(
            clients.sockets.length === 500,
            "Initial connection failed"
        );

        await join(clients.sockets, matchId);
        await close(clients.sockets);

        await waitFor(
            async () =>
                (await roomCount(ROOT, matchId)) === 0,
            "Disconnected room empty"
        );

        clients = await pool(500);

        assert(
            clients.sockets.length === 500,
            "Reconnection failed"
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
            ...result,
            reconnected: clients.sockets.length,

            pass:
                result.receivedDeliveries === 500 &&
                result.duplicates === 0
        };
    } finally {
        await close(clients.sockets);
    }
}

// 25.6.8.9
async function invalid(repetition) {
    const clients = await pool(10);

    try {
        assert(
            clients.sockets.length === 10,
            "Clients failed"
        );

        for (const client of clients.sockets) {
            for (const invalidId of [
                "",
                " ",
                null,
                123
            ]) {
                client.emit("join-match", invalidId);
            }
        }

        await sleep(300);

        const memberships = await Promise.all(
            ["", " ", "null", "123"].map(
                matchId =>
                    roomCount(ROOT, matchId).catch(() => 0)
            )
        );

        const result = {
            clients: 10,
            invalidEmits: 40,
            unexpectedRoomMembers:
                memberships.reduce(
                    (sum, count) => sum + count,
                    0
                )
        };

        return {
            ...result,
            pass:
                result.unexpectedRoomMembers === 0
        };
    } finally {
        await close(clients.sockets);
    }
}

// 25.6.8.10
async function crossInstance(repetition) {
    const matchId = `cross-${repetition}`;

    const a = await pool(100, ROOT);
    const b = await pool(100, OTHER);

    try {
        assert(
            a.sockets.length === 100 &&
            b.sockets.length === 100,
            "Both instances need 100 clients"
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

        return {
            clientsPerInstance: 100,
            expectedDeliveries: 400,
            receivedDeliveries: received,
            deliveryRate: rate(received, 400),
            duplicates:
                ta.duplicates + tb.duplicates,
            foreignDeliveries:
                ta.foreign + tb.foreign,

            pass:
                received === 400 &&
                ta.duplicates + tb.duplicates === 0 &&
                ta.foreign + tb.foreign === 0
        };
    } finally {
        await close([
            ...a.sockets,
            ...b.sockets
        ]);
    }
}

// Automated suite orchestration
const scenarios = [
    ["connections-100", rep => connections(100, rep)],
    ["connections-500", rep => connections(500, rep)],
    ["connections-1000", rep => connections(1000, rep)],
    ["subscriptions", subscriptions],
    ["broadcast", broadcast],
    ["multiroom", multiroom],
    ["sustained", sustained],
    ["reconnect", reconnect],
    ["invalid", invalid],
    ["cross-instance", crossInstance]
];

await fs.mkdir(OUT, {
    recursive: true
});

const all = [];

for (const [name, scenario] of scenarios) {
    for (let rep = 1; rep <= REPEATS; rep++) {
        console.log(
            `START ${name} repetition ${rep}/${REPEATS}`
        );

        let result;

        try {
            result = await scenario(rep);
        } catch (error) {
            result = {
                pass: false,
                error: error.stack || String(error)
            };
        }

        const record = {
            scenario: name,
            repetition: rep,
            timestamp: new Date().toISOString(),
            ...result
        };

        all.push(record);

        await fs.writeFile(
            path.join(
                OUT,
                `${name}-run-${rep}.json`
            ),
            JSON.stringify(record, null, 2)
        );

        console.log(
            `${record.pass ? "PASS" : "FAIL"} ` +
            `${name} repetition ${rep}: ` +
            JSON.stringify(record)
        );

        await sleep(400);
    }
}

const summary = {
    runs: all.length,
    passed: all.filter(result => result.pass).length,
    failed: all.filter(result => !result.pass).length,
    results: all
};

await fs.writeFile(
    path.join(OUT, "summary.json"),
    JSON.stringify(summary, null, 2)
);

console.log(
    `FINISHED ${summary.passed}/${summary.runs} passed`
);

if (summary.failed) {
    process.exitCode = 1;
}

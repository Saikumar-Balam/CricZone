
import { io as createClient } from "socket.io-client";
import { performance } from "node:perf_hooks";
import path from "node:path";

import { websocketBenchmarkConfig as config }
    from "./websocket-config.js";

import WebSocketReporter from "./websocket-reporter.js";

const BASE_URL =
    `http://${config.server.host}:${config.server.port}`;

const reporter = new WebSocketReporter(
    path.resolve("benchmarks/websocket/websocket-results")
);

const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

async function request(endpoint, options = {}) {
    const response = await fetch(
        `${BASE_URL}${endpoint}`,
        options
    );

    const result = await response.json();

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}: ${JSON.stringify(result)}`
        );
    }

    return result;
}

function createSocket() {
    return createClient(BASE_URL, {
        transports: ["websocket"],
        reconnection: false,
        timeout: config.connection.timeoutMs,
        forceNew: true,
        autoConnect: false
    });
}

async function connectSocket(socket) {
    const start = performance.now();

    return new Promise(resolve => {
        let settled = false;

        const finish = (success, error = null) => {
            if (settled) return;
            settled = true;

            socket.off("connect", onConnect);
            socket.off("connect_error", onError);

            resolve({
                success,
                latencyMs: performance.now() - start,
                error
            });
        };

        const onConnect = () => finish(true);

        const onError = error =>
            finish(false, error.message);

        socket.once("connect", onConnect);
        socket.once("connect_error", onError);

        socket.connect();

        setTimeout(() => {
            finish(false, "Connection timeout");
        }, config.connection.timeoutMs);
    });
}

async function connectClients(count) {
    const clients = [];
    const latencies = [];
    const errors = [];

    for (
        let offset = 0;
        offset < count;
        offset += config.connection.batchSize
    ) {
        const batchCount = Math.min(
            config.connection.batchSize,
            count - offset
        );

        const batch = Array.from(
            { length: batchCount },
            () => createSocket()
        );

        const results = await Promise.all(
            batch.map(connectSocket)
        );

        for (let index = 0; index < batch.length; index++) {
            const result = results[index];

            if (result.success) {
                clients.push(batch[index]);
                latencies.push(result.latencyMs);
            } else {
                errors.push(result.error);
                batch[index].disconnect();
            }
        }

        await sleep(config.connection.batchDelayMs);
    }

    return { clients, latencies, errors };
}

async function waitForRoom(matchId, expectedCount) {
    const deadline =
        Date.now() + config.connection.timeoutMs;

    while (Date.now() < deadline) {
        const result = await request(
            `/rooms?matchId=${encodeURIComponent(matchId)}`
        );

        if (result.members === expectedCount) {
            return true;
        }

        await sleep(100);
    }

    return false;
}

async function runConnectionTest(count) {
    console.log(`Running connection test: ${count} clients`);

    const { clients, latencies, errors } =
        await connectClients(count);

    try {
        const stats = await request("/stats");

        const result = {
            scenario: "connections",
            requestedClients: count,
            connectedClients: clients.length,
            failedConnections: errors.length,
            successRate: clients.length / count,
            latency: reporter.summarizeLatencies(latencies),
            serverMemory: stats.memory,
            errors
        };

        await reporter.save(`connections-${count}`, result);

        return result;
    } finally {
        clients.forEach(socket => socket.disconnect());
        await sleep(250);
    }
}

async function runBroadcastTest(count) {
    console.log(`Running broadcast test: ${count} clients`);

    const matchId = config.rooms.singleMatchId;

    const { clients, errors } = await connectClients(count);

    try {
        if (clients.length !== count) {
            throw new Error(
                `Only ${clients.length}/${count} clients connected`
            );
        }

        const received = new Set();
        const latencies = [];
        let duplicates = 0;

        for (const socket of clients) {
            socket.on("BALL_RECORDED", payload => {
                const key =
                    `${socket.id}:${payload.benchmarkEventId}`;

                if (received.has(key)) {
                    duplicates++;
                    return;
                }

                received.add(key);

                latencies.push(
                    Math.max(
                        0,
                        Date.now() - payload.benchmarkEmittedAt
                    )
                );
            });

            socket.emit("join-match", matchId);
        }

        const joined = await waitForRoom(
            matchId,
            count
        );

        if (!joined) {
            throw new Error(
                "Room membership verification failed"
            );
        }

        const eventCount = config.broadcast.eventCount;

        for (let index = 0; index < eventCount; index++) {
            await request("/emit", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    matchId,
                    eventId: `event-${index}`,
                    payload: {
                        inningsId: "benchmark-innings",
                        inningsNumber: 1,
                        score: {
                            runs: index,
                            wickets: 0,
                            legalBalls: index,
                            extras: 0
                        },
                        lastDelivery: {
                            deliveryId: `delivery-${index}`,
                            overNumber: Math.floor(index / 6),
                            ballNumber: index % 6 + 1,
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
                    }
                })
            });
        }

        const expectedDeliveries = count * eventCount;

        const deadline =
            Date.now() + config.broadcast.deliveryTimeoutMs;

        while (
            received.size < expectedDeliveries &&
            Date.now() < deadline
        ) {
            await sleep(50);
        }

        const result = {
            scenario: "single-match-broadcast",
            clients: count,
            events: eventCount,
            expectedDeliveries,
            receivedDeliveries: received.size,
            deliveryRate:
                received.size / expectedDeliveries,
            duplicates,
            latency: reporter.summarizeLatencies(latencies),
            connectionErrors: errors
        };

        await reporter.save(
            `broadcast-${count}`,
            result
        );

        return result;
    } finally {
        clients.forEach(socket => socket.disconnect());
        await sleep(250);
    }
}

async function main() {
    const results = [];

    try {
        await request("/health");

        for (const count of config.connection.clientCounts) {
            results.push(
                await runConnectionTest(count)
            );
        }

        results.push(
            await runBroadcastTest(500)
        );

        const failed = results.some(result => {
            if (result.scenario === "connections") {
                return result.successRate <
                    config.targets.connectionSuccessRate;
            }

            return result.deliveryRate <
                config.targets.deliverySuccessRate ||
                result.duplicates > 0;
        });

        if (failed) {
            console.error(
                "WebSocket benchmark correctness targets failed"
            );

            process.exitCode = 1;
        } else {
            console.log(
                "WebSocket benchmark scenarios completed successfully"
            );
        }
    } catch (error) {
        console.error(
            "WebSocket benchmark failed:",
            error
        );

        process.exitCode = 1;
    }
}

await main();

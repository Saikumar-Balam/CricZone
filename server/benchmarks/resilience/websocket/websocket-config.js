export const websocketBenchmarkConfig = Object.freeze({
    server: {
        host: "127.0.0.1",
        port: 4005,
        transport: "websocket"
    },

    connection: {
        clientCounts: [100, 500, 1000],
        batchSize: 50,
        batchDelayMs: 250,
        timeoutMs: 10000
    },

    rooms: {
        singleMatchId: "benchmark-match-1",
        multiMatchCount: 10,
        subscriptionSettleMs: 1000
    },

    broadcast: {
        eventName: "BALL_RECORDED",
        eventsPerSecond: 10,
        durationSeconds: 60,
        deliveryTimeoutMs: 5000
    },

    reconnect: {
        clientCount: 500,
        timeoutMs: 10000
    },

    targets: {
        connectionSuccessRate: 0.99,
        deliverySuccessRate: 0.999,
        p95LatencyMs: 100,
        p99LatencyMs: 250
    }
});
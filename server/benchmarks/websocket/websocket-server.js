
import http from "node:http";
import { performance } from "node:perf_hooks";
import { Server } from "socket.io";

import SocketConnectionHandler from "../../src/websocket/SocketConnectionHandler.js";
import SocketIOGateway from "../../src/websocket/SocketIOGateway.js";
import SocketIOAdapterClientFactory from "../../src/websocket/SocketIOAdapterClientFactory.js";
import SocketIORedisAdapter from "../../src/websocket/SocketIORedisAdapter.js";
import WebSocketRooms from "../../src/websocket/WebSocketRooms.js";

const PORT = Number(process.env.WS_BENCH_PORT || 4005);
const REDIS_URL = process.env.WS_BENCH_REDIS_URL;

if (!REDIS_URL) {
    throw new Error("WS_BENCH_REDIS_URL is required");
}

const logger = {
    info() {},
    debug() {},
    warn() {},
    error(message, context) {
        console.error(message, context);
    }
};

const counters = new Map();
const gauges = new Map();

const metrics = {
    incrementCounter(name, amount = 1, labels = {}) {
        const key = `${name}:${JSON.stringify(labels)}`;
        counters.set(key, (counters.get(key) || 0) + amount);
    },

    setGauge(name, value) {
        gauges.set(name, value);
    }
};

const httpServer = http.createServer();

const io = new Server(httpServer, {
    transports: ["websocket"],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const factory = new SocketIOAdapterClientFactory(
    REDIS_URL,
    logger,
    metrics
);

let pubClient;
let subClient;
let shuttingDown = false;

const startedAt = performance.now();

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json"
    });
    res.end(JSON.stringify(data));
}

async function readJSON(req) {
    let body = "";
    let bytes = 0;

    for await (const chunk of req) {
        bytes += chunk.length;

        if (bytes > 64 * 1024) {
            const error = new Error("Request body too large");
            error.statusCode = 413;
            throw error;
        }

        body += chunk.toString();
    }

    try {
        return JSON.parse(body);
    } catch {
        const error = new Error("Invalid JSON");
        error.statusCode = 400;
        throw error;
    }
}

httpServer.on("request", async (req, res) => {
    try {
        const url = new URL(
            req.url,
            "http://127.0.0.1"
        );

        if (req.method === "GET" && url.pathname === "/health") {
            return sendJSON(res, 200, {
                status: "ok",
                clients: io.engine.clientsCount
            });
        }

        if (req.method === "GET" && url.pathname === "/rooms") {
            const matchId = url.searchParams.get("matchId");

            if (!matchId?.trim()) {
                return sendJSON(res, 400, {
                    error: "matchId is required"
                });
            }

            const room = WebSocketRooms.match(matchId);
            const members = io.sockets.adapter.rooms.get(room);

            return sendJSON(res, 200, {
                matchId,
                room,
                members: members?.size ?? 0
            });
        }

        if (req.method === "GET" && url.pathname === "/stats") {
            const memory = process.memoryUsage();

            return sendJSON(res, 200, {
                connectedClients: io.engine.clientsCount,
                uptimeMs: performance.now() - startedAt,
                memory: {
                    rssBytes: memory.rss,
                    heapUsedBytes: memory.heapUsed,
                    heapTotalBytes: memory.heapTotal
                },
                counters: Object.fromEntries(counters),
                gauges: Object.fromEntries(gauges)
            });
        }

        if (req.method === "POST" && url.pathname === "/emit") {
            const data = await readJSON(req);

            const { matchId, eventId, payload } = data;

            if (
                typeof matchId !== "string" ||
                !matchId.trim() ||
                typeof eventId !== "string" ||
                !eventId.trim() ||
                !payload ||
                typeof payload !== "object" ||
                Array.isArray(payload)
            ) {
                return sendJSON(res, 400, {
                    error: "Invalid benchmark payload"
                });
            }

            const emittedAt = Date.now();

            const gateway = new SocketIOGateway(
                io,
                logger,
                metrics
            );

            gateway.emitToRoom(
                WebSocketRooms.match(matchId),
                "BALL_RECORDED",
                {
                    ...payload,
                    matchId,
                    benchmarkEventId: eventId,
                    benchmarkEmittedAt: emittedAt
                }
            );

            return sendJSON(res, 200, {
                status: "emitted",
                eventId,
                emittedAt
            });
        }

        return sendJSON(res, 404, {
            error: "Not found"
        });
    } catch (error) {
        return sendJSON(
            res,
            error.statusCode || 500,
            { error: error.message }
        );
    }
});

async function start() {
    try {
        const clients = await factory.create();

        pubClient = clients.pubClient;
        subClient = clients.subClient;

        new SocketIORedisAdapter(logger).attach(
            io,
            pubClient,
            subClient
        );

        const handler = new SocketConnectionHandler(
            logger,
            metrics
        );

        io.on("connection", handler.handle);

        await new Promise((resolve, reject) => {
            httpServer.once("error", reject);

            httpServer.listen(
                PORT,
                "127.0.0.1",
                resolve
            );
        });

        console.log(
            `WebSocket benchmark server listening on 127.0.0.1:${PORT}`
        );
    } catch (error) {
        console.error(
            "WebSocket benchmark startup failed:",
            error
        );

        await shutdown(1);
    }
}

async function shutdown(exitCode = 0) {
    if (shuttingDown) return;

    shuttingDown = true;

    await new Promise(resolve => {
        io.close(() => resolve());
    });

    await Promise.allSettled([
        pubClient?.quit(),
        subClient?.quit()
    ]);

    process.exitCode = exitCode;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await start();

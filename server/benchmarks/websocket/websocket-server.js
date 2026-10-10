
import http from "node:http";
import { Server } from "socket.io";

import SocketConnectionHandler from "../../src/websocket/SocketConnectionHandler.js";
import SocketIOGateway from "../../src/websocket/SocketIOGateway.js";
import SocketIOAdapterClientFactory from "../../src/websocket/SocketIOAdapterClientFactory.js";
import SocketIORedisAdapter from "../../src/websocket/SocketIORedisAdapter.js";
import WebSocketRooms from "../../src/websocket/WebSocketRooms.js";

const PORT = Number(process.env.WS_BENCH_PORT || 4005);
const REDIS_URL = process.env.WS_BENCH_REDIS_URL;

if (!REDIS_URL) {
    throw new Error("WS_BENCH_REDIS_URL required");
}

const logger = {
    info() {},
    debug() {},
    warn() {},
    error: (...args) => console.error(...args)
};

const counters = new Map();
const gauges = new Map();

const metrics = {
    incrementCounter(name, amount = 1, labels = {}) {
        const key = `${name}:${JSON.stringify(labels)}`;

        counters.set(
            key,
            (counters.get(key) || 0) + amount
        );
    },

    setGauge(name, value) {
        gauges.set(name, value);
    }
};

const server = http.createServer();

const io = new Server(server, {
    transports: ["websocket"],
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

let pubClient;
let subClient;
let closing = false;

function send(res, status, data) {
    res.writeHead(status, {
        "content-type": "application/json"
    });

    res.end(JSON.stringify(data));
}

async function readBody(req) {
    const chunks = [];
    let size = 0;

    for await (const chunk of req) {
        size += chunk.length;

        if (size > 65536) {
            throw Object.assign(
                new Error("body too large"),
                { status: 413 }
            );
        }

        chunks.push(chunk);
    }

    try {
        return JSON.parse(
            Buffer.concat(chunks).toString()
        );
    } catch {
        throw Object.assign(
            new Error("invalid JSON"),
            { status: 400 }
        );
    }
}

server.on("request", async (req, res) => {
    try {
        const url = new URL(
            req.url,
            "http://127.0.0.1"
        );

        if (
            req.method === "GET" &&
            url.pathname === "/health"
        ) {
            return send(res, 200, {
                ok: true,
                port: PORT,
                clients: io.engine.clientsCount
            });
        }

        if (
            req.method === "GET" &&
            url.pathname === "/rooms"
        ) {
            const matchId =
                url.searchParams.get("matchId");

            if (!matchId?.trim()) {
                return send(res, 400, {
                    error: "matchId required"
                });
            }

            const room = WebSocketRooms.match(matchId);

            return send(res, 200, {
                matchId,
                members:
                    io.sockets.adapter.rooms.get(room)?.size || 0
            });
        }

        if (
            req.method === "GET" &&
            url.pathname === "/stats"
        ) {
            return send(res, 200, {
                clients: io.engine.clientsCount,
                memory: process.memoryUsage(),
                counters: Object.fromEntries(counters),
                gauges: Object.fromEntries(gauges)
            });
        }

        if (
            req.method === "POST" &&
            url.pathname === "/emit"
        ) {
            const {
                matchId,
                eventId,
                payload
            } = await readBody(req);

            if (
                typeof matchId !== "string" ||
                !matchId.trim() ||
                typeof eventId !== "string" ||
                !eventId.trim() ||
                !payload ||
                typeof payload !== "object" ||
                Array.isArray(payload)
            ) {
                return send(res, 400, {
                    error: "invalid payload"
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

            return send(res, 200, {
                eventId,
                emittedAt
            });
        }

        return send(res, 404, {
            error: "not found"
        });
    } catch (error) {
        return send(
            res,
            error.status || 500,
            { error: error.message }
        );
    }
});

async function shutdown(code = 0) {
    if (closing) return;

    closing = true;

    await new Promise(resolve => {
        io.close(resolve);
    });

    await Promise.allSettled([
        pubClient?.quit(),
        subClient?.quit()
    ]);

    process.exitCode = code;
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

try {
    const clients =
        await new SocketIOAdapterClientFactory(
            REDIS_URL,
            logger,
            metrics
        ).create();

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
        server.once("error", reject);

        server.listen(
            PORT,
            "127.0.0.1",
            resolve
        );
    });

    console.log(
        `WebSocket benchmark listening 127.0.0.1:${PORT}`
    );
} catch (error) {
    console.error(error);
    await shutdown(1);
}

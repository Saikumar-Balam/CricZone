import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clients = vi.hoisted(() => {
    const make = () => ({
        status: "ready",
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        duplicate: vi.fn(),
        ping: vi.fn().mockResolvedValue("PONG"),
        quit: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn()
    });
    return { pub: make(), sub: make() };
});

vi.mock("ioredis", () => ({
    default: class RedisMock { constructor() { return clients.pub; } }
}));

import Factory from "../../../src/websocket/SocketIOAdapterClientFactory.js";

describe("Aiven Redis idle keepalive", () => {
    let pubHandlers, subHandlers, logger, metrics;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        pubHandlers = {};
        subHandlers = {};
        clients.pub.status = "ready";
        clients.sub.status = "ready";
        clients.pub.duplicate.mockReturnValue(clients.sub);
        clients.pub.connect.mockResolvedValue(undefined);
        clients.sub.connect.mockResolvedValue(undefined);
        clients.pub.ping.mockResolvedValue("PONG");
        clients.sub.ping.mockResolvedValue("PONG");
        clients.pub.on.mockImplementation((event, handler) => {
            pubHandlers[event] = handler;
            return clients.pub;
        });
        clients.sub.on.mockImplementation((event, handler) => {
            subHandlers[event] = handler;
            return clients.sub;
        });
        logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        metrics = { incrementCounter: vi.fn() };
    });

    afterEach(() => {
        pubHandlers?.end?.();
        subHandlers?.end?.();
        vi.useRealTimers();
    });

    it("pings publisher and subscribed client every 60 seconds", async () => {
        await new Factory("rediss://test", logger, metrics).create();
        pubHandlers.ready();
        subHandlers.ready();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(clients.pub.ping).toHaveBeenCalledTimes(1);
        expect(clients.sub.ping).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(clients.pub.ping).toHaveBeenCalledTimes(2);
        expect(clients.sub.ping).toHaveBeenCalledTimes(2);
    });

    it("stops on disconnect and resumes without duplicate timers", async () => {
        await new Factory("rediss://test", logger, metrics).create();
        pubHandlers.ready();
        pubHandlers.ready(); // repeated ready must not create a second timer
        await vi.advanceTimersByTimeAsync(60_000);
        expect(clients.pub.ping).toHaveBeenCalledTimes(1);
        clients.pub.status = "reconnecting";
        pubHandlers.reconnecting(200);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(clients.pub.ping).toHaveBeenCalledTimes(1);
        clients.pub.status = "ready";
        pubHandlers.ready();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(clients.pub.ping).toHaveBeenCalledTimes(2);
        pubHandlers.end();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(clients.pub.ping).toHaveBeenCalledTimes(2);
    });

    it("records keepalive failures without unhandled promise rejection", async () => {
        clients.sub.ping.mockRejectedValueOnce(new Error("transient failure"));
        await new Factory("rediss://test", logger, metrics).create();
        subHandlers.ready();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(metrics.incrementCounter).toHaveBeenCalledWith(
            "websocket_adapter_keepalive_errors_total", 1, { role: "subscriber" }
        );
        expect(logger.warn).toHaveBeenCalledWith(
            "Socket.IO Redis keepalive failed",
            { role: "subscriber", errorMessage: "transient failure" }
        );
    });
});

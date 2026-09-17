import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from "vitest";

import InMemoryRateLimiter
    from "../../../src/rate-limiting/InMemoryRateLimiter.js";


describe("InMemoryRateLimiter", () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(
            new Date("2026-09-16T10:00:00.000Z")
        );
    });


    afterEach(() => {
        vi.useRealTimers();
    });


    it("should use default limit and window values", () => {

        const rateLimiter =
            new InMemoryRateLimiter();

        expect(rateLimiter.limit)
            .toBe(100);

        expect(rateLimiter.windowMs)
            .toBe(60 * 1000);

        expect(rateLimiter.clients)
            .toBeInstanceOf(Map);
    });


    it("should allow the first request for a new client", async () => {

        const rateLimiter =
            new InMemoryRateLimiter({
                limit: 3,
                windowMs: 60000
            });

        const now = Date.now();

        const result =
            await rateLimiter.consume("client-1");

        expect(result).toEqual({
            allowed: true,
            remaining: 2,
            resetAt: now + 60000
        });

        expect(
            rateLimiter.clients.get("client-1")
        ).toEqual({
            count: 1,
            resetAt: now + 60000
        });
    });


    it("should increment request count within the same window", async () => {

        const rateLimiter =
            new InMemoryRateLimiter({
                limit: 3,
                windowMs: 60000
            });

        await rateLimiter.consume("client-1");

        const result =
            await rateLimiter.consume("client-1");

        expect(result.allowed)
            .toBe(true);

        expect(result.remaining)
            .toBe(1);

        expect(
            rateLimiter.clients.get("client-1").count
        ).toBe(2);
    });


    it("should reject requests after the limit is reached", async () => {

        const rateLimiter =
            new InMemoryRateLimiter({
                limit: 2,
                windowMs: 60000
            });

        await rateLimiter.consume("client-1");
        await rateLimiter.consume("client-1");

        const result =
            await rateLimiter.consume("client-1");

        expect(result.allowed)
            .toBe(false);

        expect(result.remaining)
            .toBe(0);

        expect(
            rateLimiter.clients.get("client-1").count
        ).toBe(2);
    });


    it("should reset the client window after expiration", async () => {

        const rateLimiter =
            new InMemoryRateLimiter({
                limit: 2,
                windowMs: 1000
            });

        await rateLimiter.consume("client-1");
        await rateLimiter.consume("client-1");

        const blocked =
            await rateLimiter.consume("client-1");

        expect(blocked.allowed)
            .toBe(false);

        vi.advanceTimersByTime(1000);

        const newNow = Date.now();

        const result =
            await rateLimiter.consume("client-1");

        expect(result).toEqual({
            allowed: true,
            remaining: 1,
            resetAt: newNow + 1000
        });

        expect(
            rateLimiter.clients.get("client-1").count
        ).toBe(1);
    });


    it("should maintain independent limits for different clients", async () => {

        const rateLimiter =
            new InMemoryRateLimiter({
                limit: 2,
                windowMs: 60000
            });

        await rateLimiter.consume("client-1");
        await rateLimiter.consume("client-1");

        const client1 =
            await rateLimiter.consume("client-1");

        const client2 =
            await rateLimiter.consume("client-2");

        expect(client1.allowed)
            .toBe(false);

        expect(client2.allowed)
            .toBe(true);

        expect(client2.remaining)
            .toBe(1);
    });

});

// SRP — class only makes rate-limit decisions.
// Abstraction — implements the RateLimiter contract.
// LSP — can substitute another RateLimiter implementation.
// OCP — Redis/distributed implementation can be added without changing consumers.
// Encapsulation — client counters and reset windows stay inside the class.
// Testability — fake timers make time-dependent behavior deterministic.
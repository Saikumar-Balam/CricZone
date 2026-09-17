import { beforeEach, describe, expect, it, vi } from "vitest";
import RedisCache from "../../../src/cache/RedisCache.js";

describe("RedisCache", () => {

    let redisClient;
    let logger;
    let cache;

    beforeEach(() => {

        redisClient = {
            get: vi.fn(),
            set: vi.fn(),
            del: vi.fn()
        };

        logger = {
            warn: vi.fn()
        };

        cache = new RedisCache(
            redisClient,
            logger
        );
    });


    describe("get()", () => {

        it("should return parsed cached value", async () => {

            redisClient.get.mockResolvedValue(
                JSON.stringify({
                    id: 1,
                    name: "India"
                })
            );

            const result = await cache.get("team:1");

            expect(redisClient.get)
                .toHaveBeenCalledWith("team:1");

            expect(result).toEqual({
                id: 1,
                name: "India"
            });
        });


        it("should return null when cache key does not exist", async () => {

            redisClient.get.mockResolvedValue(null);

            const result = await cache.get("team:999");

            expect(result).toBeNull();
        });


        it("should return null and log warning when Redis GET fails", async () => {

            const error =
                new Error("Redis unavailable");

            redisClient.get.mockRejectedValue(error);

            const result =
                await cache.get("team:1");

            expect(result).toBeNull();

            expect(logger.warn)
                .toHaveBeenCalledWith(
                    "Redis cache GET failed",
                    {
                        cacheKey: "team:1",
                        errorMessage: "Redis unavailable"
                    }
                );
        });

    });


    describe("set()", () => {

        it("should store value with TTL when ttlSeconds is provided", async () => {

            redisClient.set.mockResolvedValue("OK");

            const value = {
                id: 1,
                name: "India"
            };

            await cache.set(
                "team:1",
                value,
                300
            );

            expect(redisClient.set)
                .toHaveBeenCalledWith(
                    "team:1",
                    JSON.stringify(value),
                    {
                        EX: 300
                    }
                );
        });


        it("should store value without TTL when ttlSeconds is not provided", async () => {

            redisClient.set.mockResolvedValue("OK");

            const value = {
                id: 1,
                name: "India"
            };

            await cache.set(
                "team:1",
                value
            );

            expect(redisClient.set)
                .toHaveBeenCalledWith(
                    "team:1",
                    JSON.stringify(value)
                );
        });


        it("should log warning when Redis SET fails", async () => {

            redisClient.set.mockRejectedValue(
                new Error("Redis unavailable")
            );

            await cache.set(
                "team:1",
                {
                    id: 1
                }
            );

            expect(logger.warn)
                .toHaveBeenCalledWith(
                    "Redis cache SET failed",
                    {
                        cacheKey: "team:1",
                        errorMessage: "Redis unavailable"
                    }
                );
        });

    });


    describe("delete()", () => {

        it("should delete cache key", async () => {

            redisClient.del.mockResolvedValue(1);

            await cache.delete("team:1");

            expect(redisClient.del)
                .toHaveBeenCalledWith("team:1");
        });


        it("should log warning when Redis DELETE fails", async () => {

            redisClient.del.mockRejectedValue(
                new Error("Redis unavailable")
            );

            await cache.delete("team:1");

            expect(logger.warn)
                .toHaveBeenCalledWith(
                    "Redis cache DELETE failed",
                    {
                        cacheKey: "team:1",
                        errorMessage: "Redis unavailable"
                    }
                );
        });

    });

});

// SRP — tests only RedisCache behavior.
// DI — Redis client and logger are injected as mocks.
// DIP — RedisCache does not create its own Redis client/logger.
// LSP — behavior respects the Cache abstraction.
// Separation of Concerns — Redis infrastructure isn't mixed with service/repository testing.
// Testability — external infrastructure is replaceable with mocks.
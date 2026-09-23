import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from "vitest"

import RedisEventIdempotencyStore
    from "../../../src/messaging/RedisEventIdempotencyStore.js"


describe(
    "RedisEventIdempotencyStore",
    () =>
    {
        let redisClient
        let store


        beforeEach(() =>
        {
            redisClient = {
                set:
                    vi.fn(),

                del:
                    vi.fn()
            }


            store =
                new RedisEventIdempotencyStore(
                    redisClient,
                    {
                        keyPrefix:
                            "test:kafka:processed:",

                        ttlSeconds:
                            3600
                    }
                )
        })


        it(
            "should claim a new event",
            async () =>
            {
                redisClient.set
                    .mockResolvedValue(
                        "OK"
                    )


                const claimed =
                    await store.claim(
                        "event-123"
                    )


                expect(
                    claimed
                ).toBe(true)


                expect(
                    redisClient.set
                ).toHaveBeenCalledWith(
                    "test:kafka:processed:event-123",
                    "processing",
                    {
                        NX: true,
                        EX: 3600
                    }
                )
            }
        )


        it(
            "should reject a duplicate event claim",
            async () =>
            {
                redisClient.set
                    .mockResolvedValue(
                        null
                    )


                const claimed =
                    await store.claim(
                        "event-123"
                    )


                expect(
                    claimed
                ).toBe(false)


                expect(
                    redisClient.set
                ).toHaveBeenCalledTimes(
                    1
                )
            }
        )


        it(
            "should build the idempotency key using the configured prefix",
            () =>
            {
                const key =
                    store.buildKey(
                        "event-456"
                    )


                expect(
                    key
                ).toBe(
                    "test:kafka:processed:event-456"
                )
            }
        )


        it(
            "should release an event claim",
            async () =>
            {
                redisClient.del
                    .mockResolvedValue(
                        1
                    )


                await store.release(
                    "event-123"
                )


                expect(
                    redisClient.del
                ).toHaveBeenCalledWith(
                    "test:kafka:processed:event-123"
                )
            }
        )


        it(
            "should propagate Redis claim errors",
            async () =>
            {
                const error =
                    new Error(
                        "Redis unavailable"
                    )


                redisClient.set
                    .mockRejectedValue(
                        error
                    )


                await expect(
                    store.claim(
                        "event-123"
                    )
                ).rejects.toBe(
                    error
                )
            }
        )


        it(
            "should propagate Redis release errors",
            async () =>
            {
                const error =
                    new Error(
                        "Redis unavailable"
                    )


                redisClient.del
                    .mockRejectedValue(
                        error
                    )


                await expect(
                    store.release(
                        "event-123"
                    )
                ).rejects.toBe(
                    error
                )
            }
        )
    }
)

// Unit isolation — Redis is mocked; no real infrastructure dependency.
// DIP — behavior is tested through the idempotency-store abstraction boundary.
// SRP — tests cover only atomic claim/release behavior.
// Adapter Pattern — Redis-specific SET NX EX behavior remains encapsulated.
// Fail Fast — Redis failures propagate instead of being silently swallowed.
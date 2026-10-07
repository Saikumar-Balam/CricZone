import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest";

import HealthService
    from "../../src/health/HealthService.js";


describe("Readiness Failure", () => {

    let databaseClient;
    let redisClient;
    let kafkaHealthChecker;
    let healthService;


    beforeEach(() => {

        databaseClient = {
            healthCheck: vi.fn()
                .mockResolvedValue({
                    healthy: true
                })
        };

        redisClient = {
            ping: vi.fn()
                .mockResolvedValue("PONG")
        };

        kafkaHealthChecker = {
            check: vi.fn()
                .mockResolvedValue({
                    healthy: true
                })
        };

        healthService =
            new HealthService(
                databaseClient,
                redisClient,
                kafkaHealthChecker
            );
    });


    it(
        "should report not ready when PostgreSQL is unavailable",
        async () => {

            databaseClient.healthCheck
                .mockResolvedValue({
                    healthy: false
                });

            const result =
                await healthService.checkReadiness();

            expect(result).toEqual({
                ready: false,

                checks: {
                    database: false,
                    redis: true,
                    kafka: true
                }
            });
        }
    );


    it(
        "should continue checking Redis and Kafka after PostgreSQL failure",
        async () => {

            databaseClient.healthCheck
                .mockResolvedValue({
                    healthy: false
                });

            await healthService.checkReadiness();

            expect(
                databaseClient.healthCheck
            ).toHaveBeenCalledOnce();

            expect(
                redisClient.ping
            ).toHaveBeenCalledOnce();

            expect(
                kafkaHealthChecker.check
            ).toHaveBeenCalledOnce();
        }
    );


    it(
        "should report not ready when Redis is unavailable",
        async () => {

            redisClient.ping.mockRejectedValue(
                new Error("Redis unavailable")
            );

            const result =
                await healthService.checkReadiness();

            expect(result).toEqual({
                ready: false,

                checks: {
                    database: true,
                    redis: false,
                    kafka: true
                }
            });
        }
    );


    it(
        "should report not ready when Kafka is unavailable",
        async () => {

            kafkaHealthChecker.check
                .mockResolvedValue({
                    healthy: false
                });

            const result =
                await healthService.checkReadiness();

            expect(result).toEqual({
                ready: false,

                checks: {
                    database: true,
                    redis: true,
                    kafka: false
                }
            });
        }
    );


    it(
        "should report all failed dependencies independently",
        async () => {

            databaseClient.healthCheck
                .mockResolvedValue({
                    healthy: false
                });

            redisClient.ping.mockRejectedValue(
                new Error("Redis unavailable")
            );

            kafkaHealthChecker.check
                .mockResolvedValue({
                    healthy: false
                });

            const result =
                await healthService.checkReadiness();

            expect(result).toEqual({
                ready: false,

                checks: {
                    database: false,
                    redis: false,
                    kafka: false
                }
            });
        }
    );


    it(
        "should not throw when dependency checks fail",
        async () => {

            databaseClient.healthCheck
                .mockRejectedValue(
                    new Error("PostgreSQL unavailable")
                );

            redisClient.ping.mockRejectedValue(
                new Error("Redis unavailable")
            );

            kafkaHealthChecker.check
                .mockRejectedValue(
                    new Error("Kafka unavailable")
                );

            await expect(
                healthService.checkReadiness()
            ).resolves.toEqual({

                ready: false,

                checks: {
                    database: false,
                    redis: false,
                    kafka: false
                }
            });
        }
    );


    it(
        "should report ready when all dependencies are available",
        async () => {

            const result =
                await healthService.checkReadiness();

            expect(result).toEqual({
                ready: true,

                checks: {
                    database: true,
                    redis: true,
                    kafka: true
                }
            });
        }
    );

});

// DIP — HealthService depends on health-check abstractions.
// DI — database, Redis, and Kafka health dependencies are injected.
// Contract-based testing — mocks match the real health contracts.
// SRP — HealthService aggregates dependency readiness only.
// Failure Isolation — every dependency can fail independently.
// Resilience — thrown dependency errors produce NOT_READY instead of escaping.
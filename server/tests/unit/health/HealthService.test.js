import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest";

import HealthService
    from "../../../src/health/HealthService.js";

// Every test follows Arrange → Act → Assert.

describe("HealthService", () => {

    let databaseClient;
    let redisClient;
    let kafkaHealthChecker;
    let healthService;

    beforeEach(() => {

        // Mock DatabaseClient abstraction
        databaseClient = {
            healthCheck: vi.fn()
        };

        // Mock Redis client
        redisClient = {
            ping: vi.fn()
        };

        // Mock Kafka health-check abstraction
        kafkaHealthChecker = {
            check: vi.fn()
        };

        healthService = new HealthService(
            databaseClient,
            redisClient,
            kafkaHealthChecker
        );
    });


    it(
        "should return ready when all dependencies are healthy",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockResolvedValue(
                "PONG"
            );

            kafkaHealthChecker.check.mockResolvedValue({
                healthy: true
            });

            // Act
            const result =
                await healthService.checkReadiness();

            // Assert
            expect(result).toEqual({
                ready: true,
                checks: {
                    database: true,
                    redis: true,
                    kafka: true
                }
            });

            expect(
                databaseClient.healthCheck
            ).toHaveBeenCalledTimes(1);

            expect(
                redisClient.ping
            ).toHaveBeenCalledTimes(1);

            expect(
                kafkaHealthChecker.check
            ).toHaveBeenCalledTimes(1);
        }
    );


    it(
        "should return not ready when database fails",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: false
            });

            redisClient.ping.mockResolvedValue(
                "PONG"
            );

            kafkaHealthChecker.check.mockResolvedValue({
                healthy: true
            });

            // Act
            const result =
                await healthService.checkReadiness();

            // Assert
            expect(result.ready).toBe(false);

            expect(result.checks).toEqual({
                database: false,
                redis: true,
                kafka: true
            });
        }
    );


    it(
        "should return not ready when Redis fails",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockRejectedValue(
                new Error("Redis unavailable")
            );

            kafkaHealthChecker.check.mockResolvedValue({
                healthy: true
            });

            // Act
            const result =
                await healthService.checkReadiness();

            // Assert
            expect(result.ready).toBe(false);

            expect(result.checks).toEqual({
                database: true,
                redis: false,
                kafka: true
            });
        }
    );


    it(
        "should return not ready when Kafka is unavailable",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockResolvedValue(
                "PONG"
            );

            kafkaHealthChecker.check.mockResolvedValue({
                healthy: false
            });

            // Act
            const result =
                await healthService.checkReadiness();

            // Assert
            expect(result.ready).toBe(false);

            expect(result.checks).toEqual({
                database: true,
                redis: true,
                kafka: false
            });
        }
    );


    it(
        "should return not ready when Kafka health check throws",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockResolvedValue(
                "PONG"
            );

            kafkaHealthChecker.check.mockRejectedValue(
                new Error("Kafka unavailable")
            );

            // Act
            const result =
                await healthService.checkReadiness();

            // Assert
            expect(result.ready).toBe(false);

            expect(result.checks).toEqual({
                database: true,
                redis: true,
                kafka: false
            });
        }
    );


    it(
        "should not return ready when Kafka health checker is missing",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockResolvedValue(
                "PONG"
            );

            healthService = new HealthService(
                databaseClient,
                redisClient,
                null
            );

            // Act
            const result =
                await healthService.checkReadiness();

            // Assert
            expect(result.ready).toBe(false);

            expect(result.checks).toEqual({
                database: true,
                redis: true,
                kafka: false
            });
        }
    );


    it(
        "should not return ready when multiple dependencies fail",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: false
            });

            redisClient.ping.mockRejectedValue(
                new Error("Redis unavailable")
            );

            kafkaHealthChecker.check.mockResolvedValue({
                healthy: false
            });

            // Act
            const result =
                await healthService.checkReadiness();

            // Assert
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
});

// DIP — HealthService depends on injected health abstractions.
// DI — database, Redis and Kafka health dependencies are constructor-injected.
// SRP — HealthService only aggregates dependency readiness.
// Test Isolation — no Neon, Valkey or Kafka connection is required.
// Contract Testing — mocks follow each dependency's real health-check contract.
// Failure Isolation — each dependency can fail independently.
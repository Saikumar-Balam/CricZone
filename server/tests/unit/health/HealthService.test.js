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
    let kafkaProducer;
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

        kafkaProducer = {};

        healthService = new HealthService(
            databaseClient,
            redisClient,
            kafkaProducer
        );
    });


    it(
        "should return ready when all the dependencies are healthy",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockResolvedValue("PONG");

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
        }
    );


    it(
        "should return not ready when the database fails",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: false
            });

            redisClient.ping.mockResolvedValue("PONG");

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
        "should return not ready when redis fails",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockRejectedValue(
                new Error("Redis unavailable")
            );

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
        "should not return ready when the Kafka Producer is missing",
        async () => {

            // Arrange
            databaseClient.healthCheck.mockResolvedValue({
                healthy: true
            });

            redisClient.ping.mockResolvedValue("PONG");

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

            healthService = new HealthService(
                databaseClient,
                redisClient,
                null
            );

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

// DIP — HealthService depends on the database abstraction.
// Encapsulation — SELECT 1 belongs inside PostgresDatabaseClient.
// SRP — HealthService only aggregates dependency health.
// DI — mocked dependencies are constructor-injected.
// Test Isolation — unit tests don't connect to Neon.
// Contract-based design — tests mock healthCheck(), the database health contract.
import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import HealthService
    from "../../src/health/HealthService.js"


describe("Readiness Failure", () => {

    let databaseClient
    let redisClient
    let kafkaProducer
    let healthService


    beforeEach(() => {

        databaseClient = {
            healthCheck: vi.fn()
                .mockResolvedValue({
                    healthy: true
                })
        }

        redisClient = {
            ping: vi.fn()
                .mockResolvedValue("PONG")
        }

        kafkaProducer = {
            send: vi.fn()
        }

        healthService =
            new HealthService(
                databaseClient,
                redisClient,
                kafkaProducer
            )
    })


    it("should report not ready when PostgreSQL is unavailable", async () => {

        databaseClient.healthCheck
            .mockResolvedValue({
                healthy: false
            })

        const result =
            await healthService.checkReadiness()

        expect(result).toEqual({
            ready: false,

            checks: {
                database: false,
                redis: true,
                kafka: true
            }
        })
    })


    it("should continue checking Redis and Kafka after PostgreSQL failure", async () => {

        databaseClient.healthCheck
            .mockResolvedValue({
                healthy: false
            })

        await healthService.checkReadiness()

        expect(redisClient.ping)
            .toHaveBeenCalledOnce()

        expect(databaseClient.healthCheck)
            .toHaveBeenCalledOnce()
    })


    it("should report not ready when Redis is unavailable", async () => {

        redisClient.ping.mockRejectedValue(
            new Error("Redis unavailable")
        )

        const result =
            await healthService.checkReadiness()

        expect(result).toEqual({
            ready: false,

            checks: {
                database: true,
                redis: false,
                kafka: true
            }
        })
    })


    it("should report not ready when Kafka producer is unavailable", async () => {

        healthService =
            new HealthService(
                databaseClient,
                redisClient,
                null
            )

        const result =
            await healthService.checkReadiness()

        expect(result).toEqual({
            ready: false,

            checks: {
                database: true,
                redis: true,
                kafka: false
            }
        })
    })


    it("should report all failed dependencies independently", async () => {

        databaseClient.healthCheck
            .mockResolvedValue({
                healthy: false
            })

        redisClient.ping.mockRejectedValue(
            new Error("Redis unavailable")
        )

        healthService =
            new HealthService(
                databaseClient,
                redisClient,
                null
            )

        const result =
            await healthService.checkReadiness()

        expect(result).toEqual({
            ready: false,

            checks: {
                database: false,
                redis: false,
                kafka: false
            }
        })
    })


    it("should not throw when dependency checks fail", async () => {

        databaseClient.healthCheck
            .mockResolvedValue({
                healthy: false
            })

        redisClient.ping.mockRejectedValue(
            new Error("Redis unavailable")
        )

        healthService =
            new HealthService(
                databaseClient,
                redisClient,
                null
            )

        await expect(
            healthService.checkReadiness()
        ).resolves.toEqual({

            ready: false,

            checks: {
                database: false,
                redis: false,
                kafka: false
            }
        })
    })


    it("should report ready when all dependencies are available", async () => {

        const result =
            await healthService.checkReadiness()

        expect(result).toEqual({
            ready: true,

            checks: {
                database: true,
                redis: true,
                kafka: true
            }
        })
    })

})

// DIP — HealthService uses DatabaseClient.healthCheck().
// DI — database, Redis, and Kafka dependencies are injected.
// Contract-based testing — mock behavior matches the real database abstraction.
// Encapsulation — PostgreSQL-specific SELECT 1 is hidden from HealthService.
// SRP — readiness service aggregates health; DB client determines DB health.
// Failure Isolation — one failed dependency doesn't prevent checking the others.
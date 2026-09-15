import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import HealthService
    from "../../src/health/HealthService.js"


describe("17.13.5 Readiness Failure", () => {

    let databaseClient
    let redisClient
    let kafkaProducer
    let healthService


    beforeEach(() => {

        databaseClient = {
            query: vi.fn()
                .mockResolvedValue({
                    rows: [{ "?column?": 1 }]
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

        databaseClient.query.mockRejectedValue(
            new Error("PostgreSQL unavailable")
        )

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

        databaseClient.query.mockRejectedValue(
            new Error("PostgreSQL unavailable")
        )

        await healthService.checkReadiness()

        expect(redisClient.ping)
            .toHaveBeenCalledOnce()

        expect(databaseClient.query)
            .toHaveBeenCalledWith(
                "select 1"
            )
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

        databaseClient.query.mockRejectedValue(
            new Error("PostgreSQL unavailable")
        )

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

        databaseClient.query.mockRejectedValue(
            new Error("PostgreSQL unavailable")
        )

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
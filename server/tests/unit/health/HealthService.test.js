import { describe, it, expect, vi, beforeEach } from "vitest";
import HealthService from "../../../src/health/HealthService.js";

// every test follows this arrange, act, assert. arrange means prepare the scenario and act means execute the actual production code and assert means verify behaviour.

// creates the test suite. All tests related to HealthService
describe("HealthService", () => {
    let databaseClient
    let redisClient
    let kafkaProducer
    let healthService
    //before every test we get the test mock which means fake db query, redis, kafka
    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        }

        redisClient = {
            ping: vi.fn()
        }

        kafkaProducer = {}

        healthService = new HealthService(databaseClient, redisClient, kafkaProducer)
    })

    it("should return ready when all the dependencies are healthy", async () => {
        // Arrange
        databaseClient.query.mockResolvedValue({
            rows: [{"?column?" : 1}]
        })

        redisClient.ping.mockResolvedValue("PONG")

        // Act
        const result = await healthService.checkReadiness()

        // Assert
        expect(result).toEqual({
            ready: true,

            checks: {
                database: true,
                redis: true,
                kafka: true
            }
        })

        expect(databaseClient.query).toHaveBeenCalledWith("select 1")

        expect(redisClient.ping).toHaveBeenCalledTimes(1)
    })
    
    it("should return not ready when the database fails", async() => {
        // Arrange
        databaseClient.query.mockRejectedValue(new Error("Database Unavailable"))

        redisClient.ping.mockResolvedValue("PONG")

        // Act
        const result = await healthService.checkReadiness()

        // Assert
        expect(result.ready).toBe(false)

        expect(result.checks).toEqual({
            database: false,
            redis: true,
            kafka: true
        })
    })

    it("should return not ready when redis fails", async() => {
        // Arrange
        databaseClient.query.mockResolvedValue({
            rows: [{"?column?" : 1}]
        })

        redisClient.ping.mockRejectedValue(new Error("Redis unavailable"))

        // Act
        const result = await healthService.checkReadiness()

        // Assert
        expect(result.ready).toBe(false)

        expect(result.checks).toEqual({
            database: true, 
            redis: false,
            kafka: true
        })
    })

    it("should not return ready when the Kafka Producer is missing", async() => {
        // Arrange
        databaseClient.query.mockResolvedValue({
            rows: [{"?column?":1}]
        })

        redisClient.ping.mockResolvedValue("PONG")

        healthService = new HealthService(databaseClient, redisClient, null)

        // Act
        const result = await healthService.checkReadiness()

        // Assert
        expect(result.ready).toBe(false)

        expect(result.checks).toEqual({
            database: true,
            redis: true,
            kafka: false
        })
    })

    it("should not return ready when the multiple dependencies fails", async() => {
        // Arrange
        databaseClient.query.mockRejectedValue(new Error("Database unavailable"))

        redisClient.ping.mockRejectedValue(new Error("Redis Unavailable"))

        healthService = new HealthService(databaseClient, redisClient, null)

        // Act
        const result = await healthService.checkReadiness()

        // Assert
        expect(result).toEqual({
            ready: false,

            checks:{
                database: false,
                redis: false,
                kafka: false
            }
        })
    })
})
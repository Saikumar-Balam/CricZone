import {describe, it, expect, vi, beforeEach} from "vitest"
import HealthController from "../../../src/controllers/HealthController.js"

// It is a real test

describe("HealthController", () => {
    let healthService
    let healthController
    let req
    let res
    let next

    beforeEach(()=> {
        healthService = {checkReadiness: vi.fn()}
        healthController = new HealthController(healthService)
        req = {}
        res = {
            status: vi.fn(),
            json: vi.fn()
        }

        res.status.mockReturnValue(res)

        next = vi.fn()
    })

    it("should return 200 for liveness health check", ()=> {
        // Act
        healthController.health(req, res, next)

        // Assert
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            status:"UP",
            service: "CricZone API"
        })
    })

    it("should return 200 when the application is ready", async () => {
        // Arrange
        healthService.checkReadiness.mockResolvedValue({ready: true,
            checks: {
                database: true,
                redis: true,
                kafka: true 
            }
    })
    // Act
    await healthController.readiness(req, res, next)
    // Assert
    expect(healthService.checkReadiness).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
        status: "READY",
        service: "CricZone API",

        dependencies: {
            database: true,
            redis: true,
            kafka: true
        }
    })
    expect(next).not.toHaveBeenCalled()
    })

    it("should return 503 when application is not ready", async () => {
        // Arrange
        healthService.checkReadiness.mockResolvedValue({
            ready: false,

            checks: {
                database: true,
                redis: false,
                kafka: true
            }
        })
        // Act
        await healthController.readiness(req, res, next)
        // Assert
        expect(res.status).toHaveBeenCalledWith(503)
        expect(res.json).toHaveBeenCalledWith({
            status: "NOT_READY",
            service: "CricZone API",

            dependencies: {
                database: true,
                redis: false,
                kafka: true
            }
        })
    })

    it("should pass unexpected errors to error middleware", async ()=> {
        // Arrange
        const error = new Error("Unexpected health error")
        healthService.checkReadiness.mockRejectedValue(error)
        // Act
        await healthController.readiness(req, res, next)
        // Assert
        expect(next).toHaveBeenCalledWith(error)
        expect(res.status).not.toHaveBeenCalled()
        expect(res.json).not.toHaveBeenCalled()
    })
})

// Dependency Injection
// Real dependencies are replaced by mocks.

// DIP
// HealthService does not construct PostgreSQL,
// Redis, or Kafka dependencies internally.

// SRP
// HealthService readiness logic and
// HealthController HTTP behavior are tested separately.

// Isolation
// Each unit is tested without external infrastructure.

// Testability
// Constructor injection makes mocks easy to inject.

// Separation of Concerns
// Service tests verify readiness logic.
// Controller tests verify HTTP behavior.
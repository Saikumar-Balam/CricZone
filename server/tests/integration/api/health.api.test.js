import {describe, it, vi, expect} from "vitest"
import request from "supertest"
import express from "express"
import createHealthRouter from "../../../src/routes/health.route.js"
import HealthController from "../../../src/controllers/HealthController.js"
import HealthService from "../../../src/health/HealthService.js"

describe("GET /api/v1/health Integration", () => {
    it("should return API health status", async () => {
        const databaseClient = {
            query: vi.fn()
        }
        const redisClient = {
            ping: vi.fn()
        }
        const kafkaProducer = {}
        const healthService = new HealthService(databaseClient, redisClient, kafkaProducer)
        const healthController = new HealthController(healthService)
        const healthRouter = createHealthRouter(healthController)
        const apiRouter = express.Router()
        apiRouter.use("/", healthRouter)
        const app = express()
        app.use("/api/v1", apiRouter)
        const response = await request(app).get("/api/v1/health")
        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            status: "UP",
            service: "CricZone API"
        })
        expect(response.headers["content-type"]).toMatch(/application\/json/)
        expect(databaseClient.query).not.toHaveBeenCalled()
        expect(redisClient.ping).not.toHaveBeenCalled()
    })
})



// SRP — /health only reports application liveness.
// DI — HealthService and its dependencies are supplied externally.
// DIP — Controller doesn't construct HealthService.
// Factory Pattern — createHealthRouter() creates the configured router.
// Layered Architecture — Router → Controller → Service boundary is preserved.
// Separation of Concerns — Liveness remains independent of dependency readiness.
// Testability — Infrastructure dependencies can be replaced with test doubles.

describe("GET /api/v1/ready Integration", () => {
    function createReadyApp({
        databaseQuery = vi.fn().mockResolvedValue({rows: []}),
        redisPing = vi.fn().mockResolvedValue("PONG"),
        kafkaProducer = {}
    } = {}){
        const databaseClient = {
            query: databaseQuery
        }
        const redisClient = {
            ping: redisPing
        }

        const healthService = new HealthService(databaseClient, redisClient, kafkaProducer)
        const healthController = new HealthController(healthService)
        const healthRouter = createHealthRouter(healthController)
        const apiRouter = express.Router()
        apiRouter.use("/", healthRouter)
        const app = express()
        app.use("/api/v1", apiRouter)
        return {
            app, databaseClient, redisClient
        }
    }
    it("should return 200 READY when all dependencies are healthy", async () => {
        const {app, databaseClient, redisClient} = createReadyApp()
        const response = await request(app).get("/api/v1/ready")
        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            status: "READY",
            service: "CricZone API",
            dependencies: {
                database: true,
                redis: true,
                kafka: true
            }
        })
        expect(databaseClient.query).toHaveBeenCalledWith("select 1")
        expect(redisClient.ping).toHaveBeenCalledOnce()
    })

    it("should return 503 NOT_READY when database is unavailable", async () => {
        const databaseQuery = vi.fn().mockRejectedValue(new Error("Database unavailable"))
        const {app} = createReadyApp({databaseQuery})
        const response = await request(app).get("/api/v1/ready")
        expect(response.status).toBe(503)
        expect(response.body).toEqual({
            status: "NOT_READY",
            service: "CricZone API",
            dependencies: {
                database: false,
                redis: true,
                kafka: true
            }
        })
    })
     it("should return 503 NOT_READY when Redis is unavailable", async () => {

        const redisPing =
            vi.fn().mockRejectedValue(
                new Error("Redis unavailable")
            )

        const {
            app
        } = createReadyApp({
            redisPing
        })

        const response =
            await request(app)
                .get("/api/v1/ready")

        expect(response.status)
            .toBe(503)

        expect(response.body.dependencies)
            .toEqual({
                database: true,
                redis: false,
                kafka: true
            })

        expect(response.body.status)
            .toBe("NOT_READY")
    })


    it("should return 503 NOT_READY when Kafka producer is unavailable", async () => {

        const {
            app
        } = createReadyApp({
            kafkaProducer: null
        })

        const response =
            await request(app)
                .get("/api/v1/ready")

        expect(response.status)
            .toBe(503)

        expect(response.body.dependencies)
            .toEqual({
                database: true,
                redis: true,
                kafka: false
            })

        expect(response.body.status)
            .toBe("NOT_READY")
        })
})
import { describe, it, expect } from "vitest"
import request from "supertest"
import express from "express"

import metricsRouter from "../../../src/routes/metrics.route.js"
import { metrics } from "../../../src/containers/metrics.container.js"

describe("GET /metrics Integration", () => {

    it("should return Prometheus metrics", async () => {

        const app = express()

        app.use("/metrics", metricsRouter)

        const response = await request(app)
            .get("/metrics")

        expect(response.status)
            .toBe(200)

        expect(response.headers["content-type"])
            .toContain("text/plain")

        expect(response.text)
            .toBeDefined()

        expect(response.text.length)
            .toBeGreaterThan(0)
    })


    it("should return the Prometheus registry content type", async () => {

        const app = express()

        app.use("/metrics", metricsRouter)

        const response = await request(app)
            .get("/metrics")

        expect(response.status)
            .toBe(200)

        expect(response.headers["content-type"])
            .toContain(
                metrics.getContentType()
                    .split(";")[0]
            )
    })


    it("should expose CricZone default metrics", async () => {

        const app = express()

        app.use("/metrics", metricsRouter)

        const response = await request(app)
            .get("/metrics")

        expect(response.status)
            .toBe(200)

        expect(response.text)
            .toContain("criczone_")
    })

})

// Abstraction — Metrics defines the metrics contract.
// LSP — PrometheusMetrics implements/substitutes the metrics abstraction.
// SRP — PrometheusMetrics handles metrics collection while the route handles HTTP exposure.
// Encapsulation — Prometheus registry/maps remain inside PrometheusMetrics.
// Adapter Pattern — PrometheusMetrics adapts Prometheus-specific operations to your generic metrics interface.
// Separation of Concerns — /metrics exposes metrics without mixing them into business APIs.
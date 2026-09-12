import { describe,it, expect, vi, beforeEach } from "vitest";
import HttpMetricsMiddleware from "../../../src/middleware/HttpMetricsMiddleware.js";

describe("HttpMetricsMiddleware", () => {
    let metrics
    let middleware
    let req
    let res 
    let next
    let finishHandler 

    beforeEach(() => {
        metrics = {
            incrementCounter: vi.fn(),
            observeHistogram: vi.fn()
        }

        middleware = new HttpMetricsMiddleware(metrics)
        req = {
            method: "GET",
            route: {
                path: "/matches"
            }
        }
        res = {
            statusCode: 200,
            on: vi.fn((event, callback) =>{
                if(event === "finish")
                {
                    finishHandler = callback
                }
            })
        }
        next = vi.fn()
    })

    it("should continue request processing", () => {
        // Act
        middleware.handle(req, res, next)
        // Assert
        expect(next).toHaveBeenCalledTimes(1)
    })

    it("should record request metrics when response finishes", () => {
        // Arrange
        middleware.handle(req, res,next)
        // Act
        finishHandler()
        // Assert
        expect(metrics.incrementCounter).toHaveBeenCalledWith("http_requests_total", 1, expect.objectContaining({
            method: "GET", 
            status: "200"
        }))
        expect(metrics.observeHistogram).toHaveBeenCalledWith("http_request_duration_ms", expect.any(Number),expect.objectContaining({
            method: "GET",
            route: "/matches"
        }))
    })

    it("should increment HTTP error metric for error response", () => {
        // Arrange
        res.statusCode = 500
        middleware.handle(req, res, next)
        // Act
        finishHandler()
        // Assert
        expect(metrics.incrementCounter).toHaveBeenCalledWith("http_errors_total", 1,expect.objectContaining({
            method: "GET",
            status: "500"
        }))
    })
})
import { describe, it, expect, vi, beforeEach } from "vitest";
import RequestLoggingMiddleware from "../../../src/middleware/RequestLoggingMiddleware.js"

describe("RequestLoggingMiddleware", () => {
    let logger
    let middleware
    let req
    let res 
    let next
    let finishHandler

    beforeEach(() => {
        logger = {
            info: vi.fn()
        }
        middleware = new RequestLoggingMiddleware(logger)
        req = {
            requestId: "request-123",
            traceId: "trace-456",
            method: "GET",
            originalUrl: "/api/v1/matches"
        }

        res = {
            statusCode: 200,
            on: vi.fn((event, callback) => {
                if(event === "finish")
                {
                    finishHandler = callback
                }
            })
        }
        next = vi.fn()
    })

    it("should register finish listener and continue request", ()=>{
        // Act
        middleware.handle(req, res, next)
        // Assert
        expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function))
        expect(next).toHaveBeenCalledTimes(1)
    })

    it("should log request information when response finishes", () => {
        // Arrange
        middleware.handle(req, res, next)

        // Act
        finishHandler()
        // Assert
        expect(logger.info).toHaveBeenCalledTimes(1)
        expect(logger.info).toHaveBeenCalledWith("HTTP request completed",expect.objectContaining({
            requestId:"request-123",
            traceId: "trace-456",
            method: "GET",
            path: "/api/v1/matches",
            statusCode: 200
        }))
    })
})
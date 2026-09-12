import {describe, it, expect, vi, beforeEach} from "vitest"
import RequestIdMiddleware from "../../../src/middleware/RequestIdMiddleware.js"

describe("RequestIdMiddleware", () => {
    let middleware
    let req
    let res
    let next

    beforeEach(() => {
        middleware = new RequestIdMiddleware()

        req = { headers: {}}
        res = {setHeader: vi.fn()}
        next = vi.fn() 
    })

    it("should generate requestId and traceId when headers are missing", () => {
        // Arrange
        // No Incoming IDs
        req.headers = {}
        // Act
        middleware.handle(req, res, next)
        // Assert
        expect(req.requestId).toBeDefined()
        expect(req.traceId).toBeDefined()

        expect(typeof req.requestId).toBe("string")
        expect(typeof req.traceId).toBe("string")
        expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", req.requestId)
        expect(res.setHeader).toHaveBeenCalledWith("X-Trace-Id", req.traceId)
        expect(next).toHaveBeenCalledTimes(1)
    })

    it("should preserve incoming requestId and traceId", () => {
        // Arrange
        req.headers = {
            "x-request-id": "request-123",
            "x-trace-id": "trace-456"
        }
        // Act
        middleware.handle(req, res, next)
        // Assert
        expect(req.requestId).toBe("request-123")
        expect(req.traceId).toBe("trace-456")
        expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", "request-123")
        expect(res.setHeader).toHaveBeenCalledWith("X-Trace-Id", "trace-456")

        expect(next).toHaveBeenCalledTimes(1)
    })
})
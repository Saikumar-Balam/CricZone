import { describe, it, expect, vi, beforeEach } from "vitest";
import RateLimiterMiddleware from "../../../src/middleware/RateLimiterMiddleware.js"

describe("RateLimiterMiddleware", () => {
    let rateLimiter
    let middleware
    let req
    let res
    let next

    beforeEach(() => {
        rateLimiter = {
            consume: vi.fn()
        }
        middleware = new RateLimiterMiddleware(rateLimiter)

        req = {
            ip:"127.0.0.1",
            requestId: "request-123"
        }

        res = {
            setHeader: vi.fn(),
            status: vi.fn(),
            json: vi.fn()
        }

        res.status.mockReturnValue(res)

        next = vi.fn()

    })

    it("should allow request when rate limit is not exceeded", async() => {
        // Arrange
        rateLimiter.consume.mockReturnValue({
            allowed: true,
            remaining: 9,
            resetAt: 1000
        })
        // Act
       await  middleware.handle(req, res, next)
        // Assert
        expect(rateLimiter.consume).toHaveBeenCalledWith("127.0.0.1")
        expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 9)
        expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", 1)
        expect(next).toHaveBeenCalledTimes(1)
        expect(res.status).not.toHaveBeenCalled()
    })

    it("should return 429 when rate limit is exceeded", async() => {
        // Arrange
        rateLimiter.consume.mockReturnValue({
            allowed: false,
            remaining: 0,
            resetAt: 1000
        })
        // Act
        await middleware.handle(req, res, next)
        // Assert
        expect(rateLimiter.consume).toHaveBeenCalledWith("127.0.0.1")
        expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0)
        expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Reset", 1)
        expect(res.status).toHaveBeenCalledWith(429)
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: {
                code:"RATE_LIMIT_EXCEEDED",
                message: "Too many requests. Please try again later.",
                requestId: "request-123"
            }
        })
        expect(next).not.toHaveBeenCalled()
    })

    it("Should pass rate limiter errors to error middleware", async() => {
        // Arrange
        const error = new Error("Rate Limiter failed")
        rateLimiter.consume.mockRejectedValue(error)
        // Act
        await middleware.handle(req, res, next)
        // Assert
        expect(rateLimiter.consume).toHaveBeenCalledWith("127.0.0.1")
        expect(next).toHaveBeenCalledWith(error)
        expect(res.status).not.toHaveBeenCalled()
    })
})

// Dependency Injection
// → middleware receives logger/metrics/rateLimiter

// DIP
// → middleware doesn't need to construct infrastructure itself

// SRP
// → RequestID handles IDs
// → Logging handles logging
// → Metrics handles measurements
// → Rate limiting handles request limits

// Separation of Concerns
// → each middleware tested independently

// Testability
// → dependencies can be replaced with mocks
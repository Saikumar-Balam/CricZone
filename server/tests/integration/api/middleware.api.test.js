import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"

import RequestIDMiddleware
    from "../../../src/middleware/RequestIDMiddleware.js"
import RateLimiterMiddleware from "../../../src/middleware/RateLimiterMiddleware.js"
import MatchIdValidationMiddleware
    from "../../../src/middleware/MatchIdValidationMiddleware.js"

import SeriesIdValidationMiddleware
    from "../../../src/middleware/SeriesIdValidationMiddleware.js"

import TeamIdValidationMiddleware
    from "../../../src/middleware/TeamIdValidationMiddleware.js"

import PlayerIdValidationMiddleware
    from "../../../src/middleware/PlayerIdValidationMiddleware.js"

import { createErrorHandler }
    from "../../../src/middleware/error.middleware.js"

import PlayerNotFoundError
    from "../../../src/errors/PlayerNotFoundError.js"
import { createApiRouter }
    from "../../../src/routes/index.js"


describe("API Middleware / Error Path Integration", () => {

    function createApp() {

        const app = express()

        const requestIDMiddleware =
            new RequestIDMiddleware()

        app.use(
            requestIDMiddleware.handle.bind(
                requestIDMiddleware
            )
        )

        app.get("/test", (req, res) => {

            return res.status(200).json({
                success: true
            })

        })

        return app
    }


    describe("Request ID Middleware", () => {

        it("should generate x-request-id when request does not provide one", async () => {

            const app = createApp()

            const response =
                await request(app)
                    .get("/test")


            expect(response.status)
                .toBe(200)


            expect(
                response.headers["x-request-id"]
            ).toBeDefined()


            expect(
                response.headers["x-request-id"]
            ).not.toBe("")
        })


        it("should preserve incoming x-request-id", async () => {

            const app = createApp()

            const requestId =
                "criczone-test-request-123"


            const response =
                await request(app)
                    .get("/test")
                    .set(
                        "x-request-id",
                        requestId
                    )


            expect(response.status)
                .toBe(200)


            expect(
                response.headers["x-request-id"]
            ).toBe(requestId)
        })


        it("should expose requestId to downstream handlers", async () => {

            const app = express()

            const requestIDMiddleware =
                new RequestIDMiddleware()


            app.use(
                requestIDMiddleware.handle.bind(
                    requestIDMiddleware
                )
            )


            app.get("/test", (req, res) => {

                return res.status(200).json({
                    requestId: req.requestId
                })

            })


            const response =
                await request(app)
                    .get("/test")


            expect(response.status)
                .toBe(200)


            expect(response.body.requestId)
                .toBeDefined()


            expect(response.body.requestId)
                .toBe(
                    response.headers["x-request-id"]
                )
        })

    })



// SRP — middleware owns correlation identifiers only.
// Separation of Concerns — request correlation stays outside controllers/services.
// Encapsulation — ID generation and propagation are contained in the middleware.
// Middleware Pattern — cross-cutting request metadata is applied through the HTTP pipeline.
// Testability — middleware can be tested independently with a minimal Express app.

describe("Trace ID Middleware", () => {

    it("should generate x-trace-id when request does not provide one", async () => {

        const app = createApp()

        const response =
            await request(app)
                .get("/test")


        expect(response.status)
            .toBe(200)


        expect(
            response.headers["x-trace-id"]
        ).toBeDefined()


        expect(
            response.headers["x-trace-id"]
        ).not.toBe("")
    })


    it("should preserve incoming x-trace-id", async () => {

        const app = createApp()

        const traceId =
            "criczone-test-trace-123"


        const response =
            await request(app)
                .get("/test")
                .set(
                    "x-trace-id",
                    traceId
                )


        expect(response.status)
            .toBe(200)


        expect(
            response.headers["x-trace-id"]
        ).toBe(traceId)
    })


    it("should expose traceId to downstream handlers", async () => {

        const app = express()

        const requestIDMiddleware =
            new RequestIDMiddleware()


        app.use(
            requestIDMiddleware.handle.bind(
                requestIDMiddleware
            )
        )


        app.get("/test", (req, res) => {

            return res.status(200).json({
                traceId: req.traceId
            })

        })


        const response =
            await request(app)
                .get("/test")


        expect(response.status)
            .toBe(200)


        expect(response.body.traceId)
            .toBeDefined()


        expect(response.body.traceId)
            .toBe(
                response.headers["x-trace-id"]
            )
    })
})
// SRP — correlation-ID responsibility stays in one middleware.
// Separation of Concerns — tracing is outside business logic.
// Middleware Pattern — trace context propagates through the HTTP pipeline.
// Encapsulation — trace-ID generation and propagation are centralized.
// DRY — request and trace correlation share the same middleware infrastructure.

describe("Rate Limit Middleware", () => {

    it("should set correct Retry-After when rate limit is exceeded", async () => {

        vi.useFakeTimers({
            toFake: ["Date"]
        })

        vi.setSystemTime(
            new Date("2026-09-20T12:00:00.000Z")
        )

        try {

            const now =
                Date.now()

            const {
                app
            } = createRateLimitApp({
                allowed: false,
                remaining: 0,

                // Window resets in 60 seconds.
                resetAt:
                    now + 60_000
            })

            const response =
                await request(app)
                    .get("/test")

            expect(response.status)
                .toBe(429)

            expect(
                response.headers[
                    "retry-after"
                ]
            ).toBe("60")

            expect(
                response.headers[
                    "x-ratelimit-remaining"
                ]
            ).toBe("0")

            expect(
                response.headers[
                    "x-ratelimit-reset"
                ]
            ).toBe(
                String(
                    Math.ceil(
                        (now + 60_000) / 1000
                    )
                )
            )

        }
        finally {

            vi.useRealTimers()
        }
    })


    function createRateLimitApp(rateLimitResult) {

        const rateLimiter = {
            consume:
                vi.fn().mockResolvedValue(
                    rateLimitResult
                )
        }

        const rateLimitMiddleware =
            new RateLimiterMiddleware(
                rateLimiter
            )

        const app = express()

        // Simulates RequestIDMiddleware having
        // already populated requestId.
        app.use((req, res, next) => {

            req.requestId =
                "test-request-id"

            next()
        })

        app.use(
            rateLimitMiddleware.handle
        )

        app.get("/test", (req, res) => {

            return res.status(200).json({
                success: true
            })
        })

        return {
            app,
            rateLimiter
        }
    }


    it("should allow request when rate limit is not exceeded", async () => {

        const {
            app,
            rateLimiter
        } = createRateLimitApp({
            allowed: true,
            remaining: 4,
            resetAt: 1000
        })

        const response =
            await request(app)
                .get("/test")

        expect(response.status)
            .toBe(200)

        expect(response.body)
            .toEqual({
                success: true
            })

        expect(
            response.headers[
                "x-ratelimit-remaining"
            ]
        ).toBe("4")

        expect(
            response.headers[
                "x-ratelimit-reset"
            ]
        ).toBe("1")

        expect(rateLimiter.consume)
            .toHaveBeenCalledOnce()

        expect(rateLimiter.consume)
            .toHaveBeenCalledWith(
                expect.any(String)
            )
    })


    it("should return 429 when rate limit is exceeded", async () => {

        const {
            app,
            rateLimiter
        } = createRateLimitApp({
            allowed: false,
            remaining: 0,
            resetAt: 2000
        })

        const response =
            await request(app)
                .get("/test")

        expect(response.status)
            .toBe(429)

        expect(response.body)
            .toEqual({
                success: false,

                error: {
                    code:
                        "RATE_LIMIT_EXCEEDED",

                    message:
                        "Too many requests. Please try again later.",

                    requestId:
                        "test-request-id"
                }
            })

        expect(
            response.headers[
                "x-ratelimit-remaining"
            ]
        ).toBe("0")

        expect(
            response.headers[
                "x-ratelimit-reset"
            ]
        ).toBe("2")

        expect(rateLimiter.consume)
            .toHaveBeenCalledOnce()
    })

})
// SRP — middleware handles only HTTP rate-limit behavior.
// DI — rateLimiter is injected.
// DIP — middleware depends on rate-limiter behavior, not Redis/in-memory implementation.
// OCP/LSP — limiter implementations can be swapped without changing middleware.
// Separation of Concerns — rate limiting stays outside controllers and services.

describe("ID Validation Middleware", () => {

    function createValidationApp({
        MiddlewareClass,
        validatorMethod,
        paramName
    }) {

        const validationError =
            new Error("Invalid ID")

        const validator = {
            [validatorMethod]: vi.fn((value) => {

                const id = Number(value)

                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    throw validationError
                }

                return id
            })
        }
        const validationMiddleware =
            new MiddlewareClass(validator)

        const app = express()


        app.get(
            `/test/:${paramName}`,
            validationMiddleware.handle,

            (req, res) => {

                return res.status(200).json({
                    success: true,
                    id: req.params[paramName]
                })
            }
        )
        app.use((error, req, res, next) => {

            return res.status(400).json({
                success: false,
                message: error.message
            })
        })


        return {
            app,
            validator
        }
    }


    const middlewareCases = [

        {
            name: "Match",
            MiddlewareClass:
                MatchIdValidationMiddleware,
            validatorMethod:
                "validateMatchId",
            paramName:
                "matchId"
        },

        {
            name: "Series",
            MiddlewareClass:
                SeriesIdValidationMiddleware,
            validatorMethod:
                "validateSeriesId",
            paramName:
                "seriesId"
        },

        {
            name: "Team",
            MiddlewareClass:
                TeamIdValidationMiddleware,
            validatorMethod:
                "validateTeamId",
            paramName:
                "teamId"
        },

        {
            name: "Player",
            MiddlewareClass:
                PlayerIdValidationMiddleware,
            validatorMethod:
                "validatePlayerId",
            paramName:
                "playerId"
        }

    ]


    for (const {
        name,
        MiddlewareClass,
        validatorMethod,
        paramName
    } of middlewareCases) {


        it(`should allow valid ${name} ID`, async () => {

            const {
                app,
                validator
            } = createValidationApp({
                MiddlewareClass,
                validatorMethod,
                paramName
            })


            const response =
                await request(app)
                    .get("/test/101")


            expect(response.status)
                .toBe(200)


            expect(response.body)
                .toEqual({
                    success: true,
                    id: 101
                })


            expect(
                validator[validatorMethod]
            ).toHaveBeenCalledWith("101")
        })


        it(`should reject invalid ${name} ID`, async () => {

            const {
                app,
                validator
            } = createValidationApp({
                MiddlewareClass,
                validatorMethod,
                paramName
            })


            const response =
                await request(app)
                    .get("/test/invalid")


            expect(response.status)
                .toBe(400)


            expect(response.body)
                .toEqual({
                    success: false,
                    message: "Invalid ID"
                })


            expect(
                validator[validatorMethod]
            ).toHaveBeenCalledWith(
                "invalid"
            )
        })

    }

})
// SRP — each middleware handles ID validation only.
// DI — validators are constructor-injected.
// DIP — middleware delegates validation instead of implementing validation rules.
// LSP — compatible validator implementations can be substituted.
// Separation of Concerns — validation and HTTP error formatting remain separate.

describe("AppError Handling", () => {

    function createAppErrorTestApp() {

        const logger = {
            error: vi.fn()
        }

        const errorHandler =
            createErrorHandler(logger)

        const app = express()


        // Simulate correlation IDs normally
        // created by RequestIDMiddleware.
        app.use((req, res, next) => {

            req.requestId =
                "test-request-id"

            req.traceId =
                "test-trace-id"

            next()
        })


        // Test route deliberately produces
        // an operational AppError.
        app.get(
            "/players/:playerId",
            (req, res, next) => {

                next(
                    new PlayerNotFoundError(
                        req.params.playerId
                    )
                )
            }
        )
        // Centralized error middleware
        // must always be registered last.
        app.use(errorHandler)

        return {
            app,
            logger
        }
    }


    it("should return 404 for PlayerNotFoundError", async () => {

        const {
            app
        } = createAppErrorTestApp()


        const response =
            await request(app)
                .get("/players/999")


        expect(response.status)
            .toBe(404)
    })


    it("should return standard AppError response contract", async () => {

        const {
            app
        } = createAppErrorTestApp()


        const response =
            await request(app)
                .get("/players/999")


        expect(response.body)
            .toEqual({
                success: false,

                error: {
                    code:
                        "PLAYER_NOT_FOUND",

                    message:
                        "Player with id 999 was not found",

                    requestId:
                        "test-request-id"
                }
            })
    })


    it("should preserve AppError code and message", async () => {

        const {
            app
        } = createAppErrorTestApp()


        const response =
            await request(app)
                .get("/players/123")


        expect(response.body.error.code)
            .toBe(
                "PLAYER_NOT_FOUND"
            )


        expect(response.body.error.message)
            .toBe(
                "Player with id 123 was not found"
            )
    })


    it("should include requestId in AppError response", async () => {

        const {
            app
        } = createAppErrorTestApp()


        const response =
            await request(app)
                .get("/players/999")


        expect(
            response.body.error.requestId
        ).toBe(
            "test-request-id"
        )
    })


    it("should log AppError with request and trace context", async () => {

        const {
            app,
            logger
        } = createAppErrorTestApp()


        await request(app)
            .get("/players/999")


        expect(logger.error)
            .toHaveBeenCalledOnce()


        expect(logger.error)
            .toHaveBeenCalledWith(
                "HTTP request failed",

                {
                    requestId:
                        "test-request-id",

                    traceId:
                        "test-trace-id",

                    method:
                        "GET",

                    path:
                        "/players/999",

                    statusCode:
                        404,

                    errorCode:
                        "PLAYER_NOT_FOUND",

                    errorMessage:
                        "Player with id 999 was not found"
                }
            )
    })


    it("should recognize PlayerNotFoundError as operational AppError", async () => {

        const error =
            new PlayerNotFoundError(999)


        expect(error.statusCode)
            .toBe(404)

        expect(error.code)
            .toBe(
                "PLAYER_NOT_FOUND"
            )

        expect(error.message)
            .toBe(
                "Player with id 999 was not found"
            )

        expect(error.isOperational)
            .toBe(true)
    })

})
// SRP — error middleware handles HTTP error translation.
// Inheritance — PlayerNotFoundError → NotFoundError → AppError.
// OCP — new AppError subclasses work without modifying the handler.
// LSP — PlayerNotFoundError can be handled wherever AppError is expected.
// DI — logger is injected into createErrorHandler.
// DIP — error handling is not coupled to a concrete logger implementation.
// Separation of Concerns — business errors and HTTP error formatting remain separate.

describe("Unexpected Error Handling", () => {

    function createUnexpectedErrorApp() {

        const logger = {
            error: vi.fn()
        }

        const errorHandler =
            createErrorHandler(logger)

        const app = express()


        // Simulate RequestIDMiddleware
        app.use((req, res, next) => {

            req.requestId =
                "test-request-id"

            req.traceId =
                "test-trace-id"

            next()
        })


        // Simulate an unexpected programming /
        // infrastructure error.
        app.get("/unexpected-error", (req, res, next) => {

            next(
                new Error(
                    "Database connection crashed"
                )
            )

        })


        // Centralized error handler must be last.
        app.use(errorHandler)


        return {
            app,
            logger
        }
    }


    it("should return 500 for unexpected error", async () => {

        const {
            app
        } = createUnexpectedErrorApp()


        const response =
            await request(app)
                .get("/unexpected-error")


        expect(response.status)
            .toBe(500)
    })


    it("should return safe internal server error response", async () => {

        const {
            app
        } = createUnexpectedErrorApp()


        const response =
            await request(app)
                .get("/unexpected-error")


        expect(response.body)
            .toEqual({
                success: false,

                error: {
                    code:
                        "INTERNAL_SERVER_ERROR",

                    message:
                        "Something went wrong",

                    requestId:
                        "test-request-id"
                }
            })
    })


    it("should not expose internal error message to client", async () => {

        const {
            app
        } = createUnexpectedErrorApp()


        const response =
            await request(app)
                .get("/unexpected-error")


        expect(
            response.body.error.message
        ).not.toContain(
            "Database connection crashed"
        )


        expect(
            JSON.stringify(response.body)
        ).not.toContain(
            "Database connection crashed"
        )
    })


    it("should not expose stack trace to client", async () => {

        const {
            app
        } = createUnexpectedErrorApp()


        const response =
            await request(app)
                .get("/unexpected-error")


        expect(response.body.error.stack)
            .toBeUndefined()


        expect(response.body.stack)
            .toBeUndefined()
    })


    it("should log unexpected error with correlation context", async () => {

        const {
            app,
            logger
        } = createUnexpectedErrorApp()


        await request(app)
            .get("/unexpected-error")


        expect(logger.error)
            .toHaveBeenCalledOnce()


        expect(logger.error)
            .toHaveBeenCalledWith(
                "Unhandled HTTP request error",

                expect.objectContaining({

                    requestId:
                        "test-request-id",

                    traceId:
                        "test-trace-id",

                    method:
                        "GET",

                    path:
                        "/unexpected-error",

                    statusCode:
                        500,

                    errorCode:
                        "INTERNAL_SERVER_ERROR",

                    errorMessage:
                        "Database connection crashed"
                })
            )
    })

})
// SRP — centralized middleware handles HTTP error translation.
// Separation of Concerns — internal logging and client error responses are separated.
// DI — logger remains injected.
// DIP — handler isn't tied to a concrete logger.
// Fail-safe error handling — unknown errors become controlled HTTP 500 responses.
// Information hiding — internal exception details aren't exposed to API clients.
describe("Unknown Route Handling", () => {

    function createUnknownRouteApp() {

        const logger = {
            error: vi.fn()
        }

        const errorHandler =
            createErrorHandler(logger)


        // Empty routers are enough because we're
        // testing only the API routing boundary.
        const createEmptyRouter = () =>
            express.Router()


        const apiRouter =
            createApiRouter({

                matchRouter:
                    createEmptyRouter(),

                teamRouter:
                    createEmptyRouter(),

                playerRouter:
                    createEmptyRouter(),

                seriesRouter:
                    createEmptyRouter(),

                venueRouter:
                    createEmptyRouter(),

                rankingRouter:
                    createEmptyRouter(),

                newsRouter:
                    createEmptyRouter(),

                statisticsRouter:
                    createEmptyRouter(),

                devRouter:
                    createEmptyRouter()
            })


        const app = express()


        // Simulate RequestIDMiddleware.
        app.use((req, res, next) => {

            req.requestId =
                "test-request-id"

            req.traceId =
                "test-trace-id"

            next()
        })


        app.use(
            "/api/v1",
            apiRouter
        )


        // Error middleware must be last.
        app.use(errorHandler)


        return {
            app,
            logger
        }
    }


    it("should return 404 for unknown API route", async () => {

        const {
            app
        } = createUnknownRouteApp()


        const response =
            await request(app)
                .get(
                    "/api/v1/does-not-exist"
                )


        expect(response.status)
            .toBe(404)
    })


    it("should return standard error contract for unknown route", async () => {

        const {
            app
        } = createUnknownRouteApp()


        const response =
            await request(app)
                .get(
                    "/api/v1/does-not-exist"
                )


        expect(response.body)
            .toEqual({

                success: false,

                error: {

                    code:
                        "ROUTE_NOT_FOUND",

                    message:
                        "Route GET /api/v1/does-not-exist was not found",

                    requestId:
                        "test-request-id"
                }
            })
    })


    it("should log unknown route through centralized error handler", async () => {

        const {
            app,
            logger
        } = createUnknownRouteApp()


        await request(app)
            .get(
                "/api/v1/does-not-exist"
            )


        expect(logger.error)
            .toHaveBeenCalledWith(

                "HTTP request failed",

                expect.objectContaining({

                    requestId:
                        "test-request-id",

                    traceId:
                        "test-trace-id",

                    method:
                        "GET",

                    path:
                        "/api/v1/does-not-exist",

                    statusCode:
                        404,

                    errorCode:
                        "ROUTE_NOT_FOUND"
                })
            )
    })

})
})
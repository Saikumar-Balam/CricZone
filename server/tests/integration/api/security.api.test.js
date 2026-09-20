import {
    describe,
    it,
    expect
} from "vitest"
import CorsMiddleware
    from "../../../src/middleware/CorsMiddleware.js"

import { createErrorHandler }
    from "../../../src/middleware/error.middleware.js"

import request from "supertest"
import express from "express"

import SecurityHeadersMiddleware
    from "../../../src/middleware/SecurityHeadersMiddleware.js"
import JsonErrorMiddleware
    from "../../../src/middleware/JsonErrorMiddleware.js"
import {
    validateEnvironment
} from "../../../src/config/env.js"


describe("Security API Integration", () => {

    function createSecurityApp({
        isProduction = false
    } = {}) {

        const app = express()

        app.disable("x-powered-by")

        const securityHeadersMiddleware =
            new SecurityHeadersMiddleware({
                contentSecurityPolicy: true,

                strictTransportSecurity:
                    isProduction
                        ? {
                            maxAge: 31536000,
                            includeSubDomains: true
                        }
                        : false
            })

        app.use(
            securityHeadersMiddleware.handle
        )

        app.get("/test", (req, res) => {
            return res.status(200).json({
                success: true
            })
        })

        return app
    }


    describe("Security Headers", () => {

        it("should set Content-Security-Policy", async () => {

            const app =
                createSecurityApp()

            const response =
                await request(app)
                    .get("/test")

            expect(
                response.headers[
                    "content-security-policy"
                ]
            ).toBeDefined()
        })


        it("should set X-Content-Type-Options to nosniff", async () => {

            const app =
                createSecurityApp()

            const response =
                await request(app)
                    .get("/test")

            expect(
                response.headers[
                    "x-content-type-options"
                ]
            ).toBe("nosniff")
        })


        it("should set frame protection", async () => {

            const app =
                createSecurityApp()

            const response =
                await request(app)
                    .get("/test")

            expect(
                response.headers[
                    "x-frame-options"
                ]
            ).toBeDefined()
        })


        it("should set Referrer-Policy", async () => {

            const app =
                createSecurityApp()

            const response =
                await request(app)
                    .get("/test")

            expect(
                response.headers[
                    "referrer-policy"
                ]
            ).toBeDefined()
        })


        it("should not expose X-Powered-By", async () => {

            const app =
                createSecurityApp()

            const response =
                await request(app)
                    .get("/test")

            expect(
                response.headers[
                    "x-powered-by"
                ]
            ).toBeUndefined()
        })


        it("should not enable HSTS outside production", async () => {

            const app =
                createSecurityApp({
                    isProduction: false
                })

            const response =
                await request(app)
                    .get("/test")

            expect(
                response.headers[
                    "strict-transport-security"
                ]
            ).toBeUndefined()
        })


        it("should enable HSTS in production", async () => {

            const app =
                createSecurityApp({
                    isProduction: true
                })

            const response =
                await request(app)
                    .get("/test")

            expect(
                response.headers[
                    "strict-transport-security"
                ]
            ).toContain(
                "max-age=31536000"
            )
        })

    })
    

    
    // SRP — this test section verifies HTTP security headers only.
    // Black-box Testing — Supertest verifies actual client-visible headers.
    // Testability — middleware is independently constructible.
    // Regression Protection — required security headers can't disappear unnoticed.
    // Separation of Concerns — header security tests remain separate from CORS/rate-limit tests.

    describe("CORS", () => {

    function createCorsApp() {

        const allowedOrigins = [
            "https://criczone.example.com"
        ]

        const corsMiddleware =
            new CorsMiddleware(
                allowedOrigins
            )

        const logger = {
            error: () => {}
        }

        const errorHandler =
            createErrorHandler(logger)

        const app = express()

        // Simulates RequestIDMiddleware.
        app.use((req, res, next) => {
            req.requestId =
                "test-request-id"

            req.traceId =
                "test-trace-id"

            next()
        })

        app.use(
            corsMiddleware.handle
        )

        app.get("/test", (req, res) => {
            return res.status(200).json({
                success: true
            })
        })

        app.use(errorHandler)

        return app
    }


    it("should allow configured origin", async () => {

        const app =
            createCorsApp()

        const response =
            await request(app)
                .get("/test")
                .set(
                    "Origin",
                    "https://criczone.example.com"
                )

        expect(response.status)
            .toBe(200)

        expect(
            response.headers[
                "access-control-allow-origin"
            ]
        ).toBe(
            "https://criczone.example.com"
        )
    })


    it("should reject untrusted origin", async () => {

        const app =
            createCorsApp()

        const response =
            await request(app)
                .get("/test")
                .set(
                    "Origin",
                    "https://attacker.example.com"
                )

        expect(response.status)
            .toBe(403)

        expect(response.body)
            .toEqual({
                success: false,

                error: {
                    code:
                        "CORS_ORIGIN_FORBIDDEN",

                    message:
                        "Origin not allowed by CORS",

                    requestId:
                        "test-request-id"
                }
            })
    })


    it("should allow request without Origin header", async () => {

        const app =
            createCorsApp()

        const response =
            await request(app)
                .get("/test")

        expect(response.status)
            .toBe(200)

        expect(response.body)
            .toEqual({
                success: true
            })
    })

it("should allow GET request from configured origin", async () => {

    const app =
        createCorsApp()

    const response =
        await request(app)
            .get("/test")
            .set(
                "Origin",
                "https://criczone.example.com"
            )

    expect(response.status)
        .toBe(200)

    expect(
        response.headers[
            "access-control-allow-origin"
        ]
    ).toBe(
        "https://criczone.example.com"
    )
})


    it("should handle OPTIONS preflight request", async () => {

        const app =
            createCorsApp()

        const response =
            await request(app)
                .options("/test")
                .set(
                    "Origin",
                    "https://criczone.example.com"
                )
                .set(
                    "Access-Control-Request-Method",
                    "GET"
                )

        expect(
            response.status
        ).toBe(204)

        expect(
            response.headers[
                "access-control-allow-origin"
            ]
        ).toBe(
            "https://criczone.example.com"
        )

        expect(
            response.headers[
                "access-control-allow-methods"
            ]
        ).toContain("GET")
    })


    it("should allow configured request headers", async () => {

        const app =
            createCorsApp()

        const response =
            await request(app)
                .options("/test")
                .set(
                    "Origin",
                    "https://criczone.example.com"
                )
                .set(
                    "Access-Control-Request-Method",
                    "GET"
                )
                .set(
                    "Access-Control-Request-Headers",
                    "Content-Type, Accept"
                )

        expect(
            response.headers[
                "access-control-allow-headers"
            ]
        ).toContain(
            "Content-Type"
        )

        expect(
            response.headers[
                "access-control-allow-headers"
            ]
        ).toContain(
            "Accept"
        )
    })


    it("should not enable credential sharing", async () => {

        const app =
            createCorsApp()

        const response =
            await request(app)
                .get("/test")
                .set(
                    "Origin",
                    "https://criczone.example.com"
                )

        expect(
            response.headers[
                "access-control-allow-credentials"
            ]
        ).toBeUndefined()
    })

})

// Black-box Testing — test actual HTTP/CORS semantics.
// SRP — GET test verifies GET behavior; preflight test verifies preflight headers.
// Regression Protection — validates the intended CORS contract without asserting incorrect behavior.
// Separation of Concerns — don't change correct production middleware to satisfy an incorrect test.


describe("Payload Limits", () => {

    function createPayloadLimitApp() {

        const logger = {
            error: () => {}
        }

        const errorHandler =
            createErrorHandler(logger)

        const jsonErrorMiddleware =
            new JsonErrorMiddleware()

        const app = express()

        // Simulates RequestIDMiddleware.
        app.use((req, res, next) => {

            req.requestId =
                "test-request-id"

            req.traceId =
                "test-trace-id"

            next()
        })

        app.use(
            express.json({
                limit: "10kb"
            })
        )

        app.post(
            "/test",
            (req, res) => {

                return res
                    .status(200)
                    .json({
                        success: true,
                        data: req.body
                    })
            }
        )

        // Converts Express JSON parser errors
        // into CricZone AppErrors.
        app.use(
            jsonErrorMiddleware.handle
        )

        // Converts AppErrors into the
        // standard CricZone HTTP contract.
        app.use(
            errorHandler
        )

        return app
    }


    it("should allow JSON payload below 10kb", async () => {

        const app =
            createPayloadLimitApp()

        const response =
            await request(app)
                .post("/test")
                .send({
                    message:
                        "CricZone"
                })

        expect(response.status)
            .toBe(200)

        expect(response.body)
            .toEqual({
                success: true,

                data: {
                    message:
                        "CricZone"
                }
            })
    })


    it("should reject JSON payload larger than 10kb", async () => {

        const app =
            createPayloadLimitApp()

        const largePayload = {
            data:
                "A".repeat(
                    11 * 1024
                )
        }

        const response =
            await request(app)
                .post("/test")
                .send(largePayload)

        expect(response.status)
            .toBe(413)

        expect(response.body)
            .toEqual({
                success: false,

                error: {
                    code:
                        "PAYLOAD_TOO_LARGE",

                    message:
                        "Request payload too large",

                    requestId:
                        "test-request-id"
                }
            })
    })
})
//     SRP — JsonErrorMiddleware translates JSON parsing errors only.
// Separation of Concerns — Express detects oversized bodies; middleware translates errors; global handler formats responses.
// Middleware Pattern — security processing occurs through the HTTP pipeline.
// OCP — additional parser-error mappings can be added without modifying controllers.
// Black-box Integration Testing — actual CricZone middleware is tested through a real HTTP request.

describe("Error Leakage", () => {

    function createErrorLeakageApp() {

        const logger = {
            error: () => {}
        }

        const errorHandler =
            createErrorHandler(logger)

        const app = express()

        // Simulates RequestIDMiddleware.
        app.use((req, res, next) => {

            req.requestId =
                "test-request-id"

            req.traceId =
                "test-trace-id"

            next()
        })

        app.get(
            "/test-error",
            (req, res, next) => {

                next(
                    new Error(
                        "PostgreSQL password=secret123 connection failed at /server/src/database.js"
                    )
                )
            }
        )

        app.use(
            errorHandler
        )

        return app
    }


    it("should return generic message for unexpected errors", async () => {

        const app =
            createErrorLeakageApp()

        const response =
            await request(app)
                .get("/test-error")

        expect(response.status)
            .toBe(500)

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


    it("should not expose internal exception message", async () => {

        const app =
            createErrorLeakageApp()

        const response =
            await request(app)
                .get("/test-error")

        const body =
            JSON.stringify(
                response.body
            )

        expect(body)
            .not.toContain(
                "PostgreSQL"
            )

        expect(body)
            .not.toContain(
                "secret123"
            )

        expect(body)
            .not.toContain(
                "database.js"
            )
    })


    it("should not expose stack trace", async () => {

        const app =
            createErrorLeakageApp()

        const response =
            await request(app)
                .get("/test-error")

        expect(
            response.body.stack
        ).toBeUndefined()

        expect(
            response.body.error.stack
        ).toBeUndefined()

        expect(
            JSON.stringify(
                response.body
            )
        ).not.toContain(
            "Error:"
        )
    })


    it("should preserve requestId without exposing traceId", async () => {

        const app =
            createErrorLeakageApp()

        const response =
            await request(app)
                .get("/test-error")

        expect(
            response.body.error.requestId
        ).toBe(
            "test-request-id"
        )

        expect(
            response.body.error.traceId
        ).toBeUndefined()
    })

})
// Information Hiding — internal implementation details stay internal.
// SRP — centralized error middleware owns HTTP error translation.
// DI — logger is injected into the error handler.
// DIP — error handling isn't coupled to a concrete logger.
// Separation of Concerns — internal diagnostics and public error responses are separate.
// Fail-safe Error Handling — unexpected exceptions become controlled generic 500 responses.

describe("Production Configuration Validation", () => {

    function createValidProductionEnv() {

        return {
            NODE_ENV: "production",
            PORT: "5000",

            DATABASE_URL:
                "postgresql://user:password@db.example.com:5432/criczone",

            REDIS_URL:
                "rediss://user:password@redis.example.com:6380",

            KAFKA_CLIENT_ID:
                "criczone-production",

            KAFKA_BROKERS:
                "kafka.example.com:9093",

            KAFKA_USERNAME:
                "criczone-user",

            KAFKA_PASSWORD:
                "secure-kafka-password",

            KAFKA_CA_PATH:
                "./certs/ca.pem",

            KAFKA_LIVE_CONSUMER_GROUP:
                "criczone-live-production",

            CORS_ALLOWED_ORIGINS:
                "https://criczone.example.com"
        }
    }


    it("should accept valid production configuration", () => {

        const env =
            createValidProductionEnv()

        const result =
            validateEnvironment(env)

        expect(result.nodeEnv)
            .toBe("production")

        expect(result.port)
            .toBe(5000)
    })


    it("should reject production configuration with missing required variable", () => {

        const env =
            createValidProductionEnv()

        delete env.DATABASE_URL

        expect(() =>
            validateEnvironment(env)
        ).toThrow()
    })


    it("should reject insecure Redis URL in production", () => {

        const env =
            createValidProductionEnv()

        env.REDIS_URL =
            "redis://redis.example.com:6379"

        expect(() =>
            validateEnvironment(env)
        ).toThrow()
    })


    it("should reject missing Kafka credentials in production", () => {

        const env =
            createValidProductionEnv()

        delete env.KAFKA_PASSWORD

        expect(() =>
            validateEnvironment(env)
        ).toThrow()
    })


    it("should reject missing Kafka CA configuration in production", () => {

        const env =
            createValidProductionEnv()

        delete env.KAFKA_CA_PATH

        expect(() =>
            validateEnvironment(env)
        ).toThrow()
    })


    it("should reject missing production CORS origins", () => {

        const env =
            createValidProductionEnv()

        delete env.CORS_ALLOWED_ORIGINS

        expect(() =>
            validateEnvironment(env)
        ).toThrow()
    })


    it("should reject unsupported NODE_ENV", () => {

        const env =
            createValidProductionEnv()

        env.NODE_ENV =
            "invalid-environment"

        expect(() =>
            validateEnvironment(env)
        ).toThrow()
    })

})

// Fail Fast — invalid production configuration prevents startup.
// SRP — environment validation stays centralized in configuration.
// Encapsulation — security rules are contained in the configuration validator.
// DRY — tests exercise the real validator rather than duplicating its logic.
// Secure by Default — insecure Redis/Kafka configuration cannot silently reach production.
})
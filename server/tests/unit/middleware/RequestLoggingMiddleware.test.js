import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest";

import RequestLoggingMiddleware
    from "../../../src/middleware/RequestLoggingMiddleware.js";


describe("RequestLoggingMiddleware", () => {

    let logger;
    let middleware;
    let req;
    let res;
    let next;
    let finishHandler;


    beforeEach(() => {

        logger = {
            info: vi.fn()
        };

        middleware =
            new RequestLoggingMiddleware(logger);

        req = {
            requestId: "request-123",
            traceId: "trace-456",
            method: "GET",

            // Use req.path instead of originalUrl
            // so query-string values are not logged.
            path: "/api/v1/matches"
        };

        res = {
            statusCode: 200,

            on: vi.fn((event, callback) => {

                if (event === "finish") {
                    finishHandler = callback;
                }

            })
        };

        next = vi.fn();

    });


    it("should register finish listener and continue request", () => {

        // Act
        middleware.handle(
            req,
            res,
            next
        );

        // Assert
        expect(res.on)
            .toHaveBeenCalledWith(
                "finish",
                expect.any(Function)
            );

        expect(next)
            .toHaveBeenCalledTimes(1);

    });


    it("should log request information when response finishes", () => {

        // Arrange
        middleware.handle(
            req,
            res,
            next
        );

        // Act
        finishHandler();

        // Assert
        expect(logger.info)
            .toHaveBeenCalledTimes(1);

        expect(logger.info)
            .toHaveBeenCalledWith(
                "HTTP request completed",
                expect.objectContaining({
                    requestId:
                        "request-123",

                    traceId:
                        "trace-456",

                    method:
                        "GET",

                    path:
                        "/api/v1/matches",

                    statusCode:
                        200,

                    durationMs:
                        expect.any(Number)
                })
            );

    });


    it("should not log query-string values", () => {

        // Express req.path excludes the query string.
        req.path =
            "/api/v1/matches";

        req.originalUrl =
            "/api/v1/matches?token=secret123";

        middleware.handle(
            req,
            res,
            next
        );

        finishHandler();

        const metadata =
            logger.info.mock.calls[0][1];

        expect(metadata.path)
            .toBe(
                "/api/v1/matches"
            );

        expect(
            JSON.stringify(metadata)
        ).not.toContain(
            "secret123"
        );

    });

});


// SRP — RequestLoggingMiddleware is responsible
// only for HTTP request completion logging.

// DI — Logger is injected through the constructor.

// DIP — Middleware depends on the logger contract,
// not a concrete logger implementation.

// Information Hiding — req.path is logged instead
// of originalUrl so query-string values are excluded.

// Testability — Logger and Express request/response
// dependencies are mocked independently.
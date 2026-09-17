import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from "vitest";

import AppError from "../../../src/errors/AppError.js";
import {
    createErrorHandler
} from "../../../src/middleware/error.middleware.js";


describe("error.middleware", () => {

    let logger;
    let req;
    let res;
    let next;
    let errorHandler;

    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {

        logger = {
            error: vi.fn()
        };

        req = {
            requestId: "request-1",
            traceId: "trace-1",
            method: "GET",
            originalUrl: "/api/matches"
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };

        next = vi.fn();

        errorHandler = createErrorHandler(logger);
    });


    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        vi.restoreAllMocks();
    });


    it("should handle AppError using its status code and error code", () => {

        const error = new AppError(
            "Match not found",
            404,
            "MATCH_NOT_FOUND"
        );

        errorHandler(
            error,
            req,
            res,
            next
        );

        expect(logger.error)
            .toHaveBeenCalledWith(
                "HTTP request failed",
                {
                    requestId: "request-1",
                    traceId: "trace-1",
                    method: "GET",
                    path: "/api/matches",
                    statusCode: error.statusCode,
                    errorCode: error.code,
                    errorMessage: error.message
                }
            );

        expect(res.status)
            .toHaveBeenCalledWith(error.statusCode);

        expect(res.json)
            .toHaveBeenCalledWith({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    requestId: "request-1"
                }
            });
    });


    it("should handle unexpected errors with status 500", () => {

        process.env.NODE_ENV = "test";

        const error =
            new Error("Database crashed");

        errorHandler(
            error,
            req,
            res,
            next
        );

        expect(logger.error)
            .toHaveBeenCalledWith(
                "Unhandled HTTP request error",
                expect.objectContaining({
                    requestId: "request-1",
                    traceId: "trace-1",
                    method: "GET",
                    path: "/api/matches",
                    statusCode: 500,
                    errorCode:
                        "INTERNAL_SERVER_ERROR",
                    errorMessage:
                        "Database crashed",
                    stack: error.stack
                })
            );

        expect(res.status)
            .toHaveBeenCalledWith(500);

        expect(res.json)
            .toHaveBeenCalledWith({
                success: false,
                error: {
                    code:
                        "INTERNAL_SERVER_ERROR",
                    message:
                        "Something went wrong",
                    requestId: "request-1"
                }
            });
    });


    it("should hide stack trace in production", () => {

        process.env.NODE_ENV = "production";

        const error =
            new Error("Database crashed");

        errorHandler(
            error,
            req,
            res,
            next
        );

        expect(logger.error)
            .toHaveBeenCalledWith(
                "Unhandled HTTP request error",
                expect.objectContaining({
                    statusCode: 500,
                    errorCode:
                        "INTERNAL_SERVER_ERROR",
                    errorMessage:
                        "Database crashed",
                    stack: undefined
                })
            );

        expect(res.status)
            .toHaveBeenCalledWith(500);
    });


    it("should include stack trace outside production", () => {

        process.env.NODE_ENV = "test";

        const error =
            new Error("Unexpected failure");

        errorHandler(
            error,
            req,
            res,
            next
        );

        expect(logger.error)
            .toHaveBeenCalledWith(
                "Unhandled HTTP request error",
                expect.objectContaining({
                    stack: error.stack
                })
            );
    });

});

// SRP — tests only centralized error middleware.
// DI — logger is mocked and injected.
// DIP — middleware isn't tied to a concrete logger.
// Factory Function — tests middleware returned by createErrorHandler().
// Separation of Concerns — no controller/service/database behavior is involved.
// Testability — request, response, logger and next are isolated test doubles.
import {
    beforeEach,
    afterEach,
    describe,
    expect,
    it,
    vi
} from "vitest";

import StructuredLogger
    from "../../../src/logging/StructuredLogger.js";

import LogSanitizer
    from "../../../src/logging/LogSanitizer.js";


describe("StructuredLogger", () => {

    let logger;
    let consoleSpy;
    let logSanitizer;


    beforeEach(() => {

        logSanitizer =
            new LogSanitizer();

        logger =
            new StructuredLogger(
                logSanitizer
            );

        consoleSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => {});

    });


    afterEach(() => {

        vi.restoreAllMocks();

    });


    describe("info()", () => {

        it("should log INFO message with metadata", () => {

            const logSpy = vi
                .spyOn(logger, "log")
                .mockImplementation(() => {});

            logger.info(
                "Server started",
                {
                    port: 3000
                }
            );

            expect(logSpy)
                .toHaveBeenCalledWith(
                    "INFO",
                    "Server started",
                    {
                        port: 3000
                    }
                );

        });


        it("should use empty metadata by default", () => {

            const logSpy = vi
                .spyOn(logger, "log")
                .mockImplementation(() => {});

            logger.info(
                "Server started"
            );

            expect(logSpy)
                .toHaveBeenCalledWith(
                    "INFO",
                    "Server started",
                    {}
                );

        });

    });


    describe("warn()", () => {

        it("should log WARN message", () => {

            const logSpy = vi
                .spyOn(logger, "log")
                .mockImplementation(() => {});

            logger.warn(
                "High memory usage",
                {
                    usage: 80
                }
            );

            expect(logSpy)
                .toHaveBeenCalledWith(
                    "WARN",
                    "High memory usage",
                    {
                        usage: 80
                    }
                );

        });

    });


    describe("error()", () => {

        it("should log ERROR message", () => {

            const logSpy = vi
                .spyOn(logger, "log")
                .mockImplementation(() => {});

            logger.error(
                "Database failure",
                {
                    database: "postgres"
                }
            );

            expect(logSpy)
                .toHaveBeenCalledWith(
                    "ERROR",
                    "Database failure",
                    {
                        database: "postgres"
                    }
                );

        });

    });


    describe("debug()", () => {

        it("should log DEBUG message", () => {

            const logSpy = vi
                .spyOn(logger, "log")
                .mockImplementation(() => {});

            logger.debug(
                "Processing event",
                {
                    eventId: "event-1"
                }
            );

            expect(logSpy)
                .toHaveBeenCalledWith(
                    "DEBUG",
                    "Processing event",
                    {
                        eventId: "event-1"
                    }
                );

        });

    });


    describe("log()", () => {

        it("should write structured JSON log to console", () => {

            logger.log(
                "INFO",
                "Application started",
                {
                    service: "criczone"
                }
            );

            expect(consoleSpy)
                .toHaveBeenCalledOnce();

            const output =
                JSON.parse(
                    consoleSpy.mock.calls[0][0]
                );

            expect(output)
                .toEqual({
                    timestamp:
                        expect.any(String),

                    level:
                        "INFO",

                    message:
                        "Application started",

                    service:
                        "criczone"
                });

            expect(
                new Date(
                    output.timestamp
                ).toISOString()
            ).toBe(
                output.timestamp
            );

        });


        it("should use empty metadata by default", () => {

            logger.log(
                "INFO",
                "Application started"
            );

            const output =
                JSON.parse(
                    consoleSpy.mock.calls[0][0]
                );

            expect(output.level)
                .toBe("INFO");

            expect(output.message)
                .toBe(
                    "Application started"
                );

            expect(output.timestamp)
                .toEqual(
                    expect.any(String)
                );

        });


        it("should sanitize sensitive metadata before logging", () => {

            logger.log(
                "INFO",
                "User request",
                {
                    username:
                        "criczone-user",

                    password:
                        "secret123",

                    token:
                        "private-token"
                }
            );

            const output =
                JSON.parse(
                    consoleSpy.mock.calls[0][0]
                );

            expect(output.username)
                .toBe(
                    "criczone-user"
                );

            expect(output.password)
                .toBe(
                    "[REDACTED]"
                );

            expect(output.token)
                .toBe(
                    "[REDACTED]"
                );

        });

    });

});


// SRP — StructuredLogger handles structured logging,
// while LogSanitizer handles sensitive-data sanitization.

// DIP — StructuredLogger depends on an injected
// sanitization dependency instead of creating it internally.

// DI — LogSanitizer is supplied through the
// StructuredLogger constructor.

// Separation of Concerns — logging and
// security sanitization remain separate responsibilities.

// Testability — dependencies and console output
// can be controlled independently during tests.
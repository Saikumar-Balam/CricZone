import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import LiveBallEventHandler
    from "../../src/messaging/handlers/LiveBallEventHandler.js"


describe("Kafka Handler Failure", () => {

    let liveUpdateService
    let logger
    let handler

    const event = {
        eventId:
            "550e8400-e29b-41d4-a716-446655440000",

        type:
            "BALL_RECORDED",

        aggregateId: 101,

        timestamp:
            "2026-09-16T10:00:00.000Z",

        requestId:
            "request-001",

        traceId:
            "trace-001",

        payload: {
            inningsId: 201,
            inningsNumber: 1,
            overNumber: 10,
            ballNumber: 3,

            strikerId: 301,
            nonStrikerId: 302,
            bowlerId: 401,

            runs: {
                batsman: 4,
                extras: 0,
                total: 4
            },

            extras: {
                wide: 0,
                noBall: 0,
                bye: 0,
                legBye: 0,
                penalty: 0
            },

            boundary: {
                four: true,
                six: false
            },

            wicket: {
                occurred: false,
                type: null,
                dismissedPlayerId: null,
                fielderId: null
            },

            legalDelivery: true
        }
    }


    const metadata = {
        topic: "criczone.live-events",
        partition: 0,
        offset: "42"
    }


    beforeEach(() => {

        liveUpdateService = {
            processBallRecorded: vi.fn()
        }

        logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }

        handler =
            new LiveBallEventHandler(
                liveUpdateService,
                logger
            )
    })


    it("should propagate LiveUpdateService failure", async () => {

        liveUpdateService
            .processBallRecorded
            .mockRejectedValue(
                new Error(
                    "Live update processing failed"
                )
            )


        await expect(
            handler.handle(
                event,
                metadata
            )
        ).rejects.toThrow(
            "Live update processing failed"
        )
    })


    it("should invoke LiveUpdateService exactly once before failure propagates", async () => {

        liveUpdateService
            .processBallRecorded
            .mockRejectedValue(
                new Error(
                    "Database unavailable"
                )
            )


        await expect(
            handler.handle(
                event,
                metadata
            )
        ).rejects.toThrow(
            "Database unavailable"
        )


        expect(
            liveUpdateService.processBallRecorded
        ).toHaveBeenCalledOnce()


        expect(
            liveUpdateService.processBallRecorded
        ).toHaveBeenCalledWith(event)
    })


    it("should preserve original service error", async () => {

        const originalError =
            new Error(
                "Redis live cache unavailable"
            )


        liveUpdateService
            .processBallRecorded
            .mockRejectedValue(
                originalError
            )


        try {

            await handler.handle(
                event,
                metadata
            )

            throw new Error(
                "Expected handler to reject"
            )

        }
        catch (error) {

            expect(error)
                .toBe(originalError)
        }
    })


    it("should log BALL_RECORDED context before processing failure", async () => {

        liveUpdateService
            .processBallRecorded
            .mockRejectedValue(
                new Error(
                    "Processing failed"
                )
            )


        await expect(
            handler.handle(
                event,
                metadata
            )
        ).rejects.toThrow()


        expect(logger.info)
            .toHaveBeenCalledWith(

                "BALL_RECORDED event received",

                expect.objectContaining({

                    eventId:
                        event.eventId,

                    matchId:
                        event.aggregateId,

                    requestId:
                        event.requestId,

                    traceId:
                        event.traceId,

                    topic:
                        metadata.topic,

                    partition:
                        metadata.partition,

                    offset:
                        metadata.offset,

                    inningsId:
                        event.payload.inningsId,

                    overNumber:
                        event.payload.overNumber,

                    ballNumber:
                        event.payload.ballNumber
                })
            )
    })


    it("should not treat failed processing as unsupported event", async () => {

        liveUpdateService
            .processBallRecorded
            .mockRejectedValue(
                new Error(
                    "Processing failed"
                )
            )


        await expect(
            handler.handle(
                event,
                metadata
            )
        ).rejects.toThrow()


        expect(logger.warn)
            .not.toHaveBeenCalledWith(
                "Unsupported live ball event",
                expect.anything()
            )
    })

})

// SRP — handler validates and delegates live events.
// DI — LiveUpdateService and logger are injected.
// DIP — event handler is decoupled from concrete processing infrastructure.
// Delegation — business processing remains in LiveUpdateService.
// Separation of Concerns — Kafka event handling and live-update processing stay separate.
// Fail-fast propagation — processing failures aren't swallowed.
// Testability — dependencies can be replaced with deterministic failure mocks.
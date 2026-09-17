import { describe, it, expect, vi, beforeEach } from "vitest";
import LiveBallEventHandler from "../../../src/messaging/handlers/LiveBallEventHandler.js"

describe("Live Ball Event Handler", () => {
    let liveUpdateService
    let logger
    let handler

    beforeEach(() => {
        liveUpdateService = {
            processBallRecorded: vi.fn()
        }

        logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }

        handler = new LiveBallEventHandler(liveUpdateService, logger)
    })

    it("should process valid BALL_RECORDED event", async () => {
        // Arrange
        const event = {
      eventId:
        "550e8400-e29b-41d4-a716-446655440000",

      type: "BALL_RECORDED",

      aggregateId:
        "660e8400-e29b-41d4-a716-446655440000",

      timestamp:
        "2026-09-12T12:00:00.000Z",

      requestId: "request-123",
      traceId: "trace-456",

      payload: {
        inningsId:
          "880e8400-e29b-41d4-a716-446655440000",

        inningsNumber: 1,
        overNumber: 10,
        ballNumber: 3,

        strikerId:
          "990e8400-e29b-41d4-a716-446655440000",

        nonStrikerId:
          "aa0e8400-e29b-41d4-a716-446655440000",

        bowlerId:
          "bb0e8400-e29b-41d4-a716-446655440000",

        runs: 4,
        extras: 0,
        boundary: true,
        wicket: false,
        legalDelivery: true
      }
    }

    const metadata = {
      topic: "live-ball-events",
      partition: 0,
      offset: "10"
    }
        liveUpdateService.processBallRecorded.mockResolvedValue(undefined)
        // Act
        await handler.handle(event)
        // Assert
        expect(liveUpdateService.processBallRecorded).toHaveBeenCalledTimes(1)
        expect(liveUpdateService.processBallRecorded).toHaveBeenCalledWith(event)
    })

    it("should skip invalid event", async () => {
        // Arrange
        const event = {
            eventId: "INVALID-ID",
            type: "BALL_RECORDED",
            aggregateId: "660e8400-e29b-41d4-a716-446655440000",
            payload: {
                runs: 4
            }
        }
        // Act
        await handler.handle(event)
        // Assert
        expect(liveUpdateService.processBallRecorded).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalled()
    })

    it("should ignore unsupported event", async () => {
        // Arrange                              
        const event = {
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            type: "MATCH_STARTED",
            aggregateId: "660e8400-e29b-41d4-a716-446655440000",
            payload: {}
        }

        // Act
        await handler.handle(event)
        // Assert
        expect(liveUpdateService.processBallRecorded).not.toHaveBeenCalled()
        expect(logger.warn).toHaveBeenCalled()
    })

    it("should propagate live update service", async () => {
        // Arrange
        const event = {
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            type: "BALL_RECORDED",
            aggregateId: "660e8400-e29b-41d4-a716-446655440000",
            traceId: "770e8400-e29b-41d4-a716-446655440000",
            payload: {
                runs: 4
            }
        }
        const error = new Error("Live update failed")
        liveUpdateService.processBallRecorded.mockRejectedValue(error)
        // Act + Assert
        await expect(handler.handle(event)).rejects.toThrow("Live update failed")
    })
    describe("isValidEvent()", () => {

    it("should return false when event is null", () => {
        expect(
            handler.isValidEvent(null)
        ).toBe(false);
    });


    it("should return false when eventId is missing", () => {

        const event = {
            type: "BALL_RECORDED",
            aggregateId: "match-1",
            payload: {}
        };

        expect(
            handler.isValidEvent(event)
        ).toBe(false);
    });


    it("should return false when eventId is not a valid UUID", () => {

        const event = {
            eventId: "invalid-id",
            type: "BALL_RECORDED",
            aggregateId: "match-1",
            payload: {}
        };

        expect(
            handler.isValidEvent(event)
        ).toBe(false);
    });


    it("should return false when event type is missing", () => {

        const event = {
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            aggregateId: "match-1",
            payload: {}
        };

        expect(
            handler.isValidEvent(event)
        ).toBe(false);
    });


    it("should return false when aggregateId is null", () => {

        const event = {
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            type: "BALL_RECORDED",
            aggregateId: null,
            payload: {}
        };

        expect(
            handler.isValidEvent(event)
        ).toBe(false);
    });


    it("should return false when payload is missing", () => {

        const event = {
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            type: "BALL_RECORDED",
            aggregateId: "match-1"
        };

        expect(
            handler.isValidEvent(event)
        ).toBe(false);
    });


    it("should return true for valid event", () => {

        const event = {
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            type: "BALL_RECORDED",
            aggregateId: "match-1",
            payload: {}
        };

        expect(
            handler.isValidEvent(event)
        ).toBe(true);
    });

});

})


// SRP
// LiveBallEventHandler tests only event handling responsibility.

// DI
// LiveUpdateService and Logger are injected.

// DIP
// Handler works against collaborator behavior rather than creating dependencies.

// Delegation — processing is delegated to LiveUpdateService.

// Isolation
// Kafka/Redis/PostgreSQL/WebSocket are excluded.

// Testability
// Constructor DI lets us replace real dependencies with vi.fn() mocks.
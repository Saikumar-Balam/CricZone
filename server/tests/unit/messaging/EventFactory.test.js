import { describe, expect, it } from "vitest";
import { createEvent } from "../../../src/messaging/EventFactory.js";

describe("EventFactory", () => {

    it("should use provided traceId and requestId", () => {

        const event = createEvent({
            type: "BALL_RECORDED",
            aggregateId: "match-1",
            payload: {
                runs: 4
            },
            requestId: "request-123",
            traceId: "trace-123"
        });

        expect(event.type).toBe("BALL_RECORDED");
        expect(event.aggregateId).toBe("match-1");
        expect(event.requestId).toBe("request-123");
        expect(event.traceId).toBe("trace-123");
        expect(event.payload).toEqual({
            runs: 4
        });

        expect(event.eventId)
            .toEqual(expect.any(String));

        expect(event.timestamp)
            .toEqual(expect.any(String));
    });


    it("should generate traceId and default requestId to null", () => {

        const event = createEvent({
            type: "BALL_RECORDED",
            aggregateId: "match-1",
            payload: {
                runs: 6
            }
        });

        expect(event.requestId).toBeNull();

        expect(event.traceId)
            .toEqual(expect.any(String));

        expect(event.traceId.length)
            .toBeGreaterThan(0);

        expect(event.eventId)
            .toEqual(expect.any(String));
    });

});

// SRP — tests only event creation behavior.
// Factory Pattern — verifies centralized event construction.
// DRY — common event metadata creation stays in createEvent().
// Encapsulation — UUID/timestamp generation remains inside the factory.
// Testability — verifies both supplied and fallback metadata paths.
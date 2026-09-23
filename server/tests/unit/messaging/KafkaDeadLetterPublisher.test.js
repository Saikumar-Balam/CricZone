import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import KafkaDeadLetterPublisher
    from "../../../src/messaging/KafkaDeadLetterPublisher.js"


describe("KafkaDeadLetterPublisher", () => {

    let eventProducer
    let publisher


    beforeEach(() => {

        eventProducer = {
            publish:
                vi.fn()
                    .mockResolvedValue({
                        success: true
                    })
        }


        publisher =
            new KafkaDeadLetterPublisher(
                eventProducer,
                {
                    topic:
                        "test.live-events.dlq"
                }
            )
    })


    it("should publish failed event to configured DLQ topic", async () => {

        const event = {
            eventId:
                "event-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1",

            runs:
                4
        }


        const context = {
            topic:
                "criczone.live-events",

            partition:
                2,

            offset:
                "100",

            key:
                "match-1"
        }


        const error =
            new Error(
                "processing failed"
            )


        await publisher.publish(
            event,
            context,
            error
        )


        expect(
            eventProducer.publish
        ).toHaveBeenCalledTimes(1)


        expect(
            eventProducer.publish
        ).toHaveBeenCalledWith(
            "test.live-events.dlq",
            expect.objectContaining({
                eventId:
                    "event-1",

                type:
                    "DEAD_LETTER_EVENT",

                aggregateId:
                    "match-1"
            })
        )
    })


    it("should preserve original event", async () => {

        const event = {
            eventId:
                "event-2",

            type:
                "WICKET_RECORDED",

            aggregateId:
                "match-2",

            playerId:
                "player-10"
        }


        await publisher.publish(
            event,
            {
                topic:
                    "criczone.live-events",

                partition:
                    0,

                offset:
                    "200",

                key:
                    "match-2"
            },
            new Error(
                "handler failed"
            )
        )


        const publishedEvent =
            eventProducer.publish
                .mock.calls[0][1]


        expect(
            publishedEvent.originalEvent
        ).toEqual(
            event
        )
    })


    it("should include failure metadata", async () => {

        const error =
            new TypeError(
                "invalid payload"
            )


        await publisher.publish(
            {
                eventId:
                    "event-3",

                type:
                    "BALL_RECORDED",

                aggregateId:
                    "match-3"
            },
            {
                topic:
                    "criczone.live-events",

                partition:
                    1,

                offset:
                    "300",

                key:
                    "match-3"
            },
            error
        )


        const publishedEvent =
            eventProducer.publish
                .mock.calls[0][1]


        expect(
            publishedEvent.failure
        ).toEqual({
            errorName:
                "TypeError",

            errorMessage:
                "invalid payload"
        })
    })


    it("should include original Kafka source metadata", async () => {

        await publisher.publish(
            {
                eventId:
                    "event-4",

                type:
                    "BALL_RECORDED",

                aggregateId:
                    "match-4"
            },
            {
                topic:
                    "criczone.live-events",

                partition:
                    3,

                offset:
                    "400",

                key:
                    "match-4"
            },
            new Error(
                "processing failed"
            )
        )


        const publishedEvent =
            eventProducer.publish
                .mock.calls[0][1]


        expect(
            publishedEvent.source
        ).toEqual({
            topic:
                "criczone.live-events",

            partition:
                3,

            offset:
                "400",

            key:
                "match-4"
        })
    })


    it("should include dead-letter metadata", async () => {

        await publisher.publish(
            {
                eventId:
                    "event-5",

                type:
                    "SCORE_UPDATED",

                aggregateId:
                    "match-5"
            },
            {
                topic:
                    "criczone.live-events",

                partition:
                    0,

                offset:
                    "500",

                key:
                    "match-5"
            },
            new Error(
                "processing failed"
            )
        )


        const publishedEvent =
            eventProducer.publish
                .mock.calls[0][1]


        expect(
            publishedEvent.deadLetter
                .originalEventType
        ).toBe(
            "SCORE_UPDATED"
        )


        expect(
            publishedEvent.deadLetter
                .failedAt
        ).toEqual(
            expect.any(String)
        )


        expect(
            Number.isNaN(
                Date.parse(
                    publishedEvent.deadLetter
                        .failedAt
                )
            )
        ).toBe(false)
    })


    it("should not include error stack in DLQ failure metadata", async () => {

        await publisher.publish(
            {
                eventId:
                    "event-6",

                type:
                    "BALL_RECORDED",

                aggregateId:
                    "match-6"
            },
            {
                topic:
                    "criczone.live-events",

                partition:
                    0,

                offset:
                    "600",

                key:
                    "match-6"
            },
            new Error(
                "processing failed"
            )
        )


        const publishedEvent =
            eventProducer.publish
                .mock.calls[0][1]


        expect(
            publishedEvent.failure
        ).not.toHaveProperty(
            "stack"
        )
    })


    it("should return producer result", async () => {

        const producerResult = {
            success:
                true,

            offset:
                "700"
        }


        eventProducer.publish
            .mockResolvedValue(
                producerResult
            )


        const result =
            await publisher.publish(
                {
                    eventId:
                        "event-7",

                    type:
                        "BALL_RECORDED",

                    aggregateId:
                        "match-7"
                },
                {
                    topic:
                        "criczone.live-events",

                    partition:
                        0,

                    offset:
                        "700",

                    key:
                        "match-7"
                },
                new Error(
                    "processing failed"
                )
            )


        expect(
            result
        ).toBe(
            producerResult
        )
    })


    it("should propagate producer failure", async () => {

        const publishError =
            new Error(
                "Kafka DLQ unavailable"
            )


        eventProducer.publish
            .mockRejectedValue(
                publishError
            )


        await expect(
            publisher.publish(
                {
                    eventId:
                        "event-8",

                    type:
                        "BALL_RECORDED",

                    aggregateId:
                        "match-8"
                },
                {
                    topic:
                        "criczone.live-events",

                    partition:
                        0,

                    offset:
                        "800",

                    key:
                        "match-8"
                },
                new Error(
                    "processing failed"
                )
            )
        ).rejects.toBe(
            publishError
        )
    })

})


// LLD principles:
//
// SRP — Tests focus only on dead-letter publishing behavior.
//
// Dependency Injection — EventProducer is injected as a mock.
//
// DIP — KafkaDeadLetterPublisher is tested without KafkaJS.
//
// Adapter Pattern — Tests verify transformation from a failed
// application event into the DLQ event envelope.
//
// Test Isolation — No real Kafka broker is required.
//
// Fail Fast — Producer publication failures propagate.
//
// Information Hiding — Internal stack traces are not included
// in the dead-letter event payload.
//
// Observability/Traceability — Original event, source location,
// failure details and failure time are preserved.
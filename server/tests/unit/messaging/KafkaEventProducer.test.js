import { describe, it, expect, vi, beforeEach } from "vitest"
import KafkaEventProducer from "../../../src/messaging/KafkaEventProducer.js"

describe("KafkaEventProducer", () => {

    let kafkaProducer
    let logger
    let producer

    beforeEach(() => {

        kafkaProducer = {
            send: vi.fn()
        }

        logger = {
            info: vi.fn(),
            error: vi.fn()
        }

        producer =
            new KafkaEventProducer(
                kafkaProducer,
                logger
            )
    })

    it("should publish event to Kafka", async () => {

        const brokerResult = [
            {
                topicName: "criczone.live.ball-events",
                partition: 0,
                baseOffset: "10"
            }
        ]

        kafkaProducer.send.mockResolvedValue(
            brokerResult
        )

        const event = {
            eventId: "event-1",
            type: "BALL_RECORDED",
            aggregateId: "match-1",
            payload: {
                matchId: 1
            }
        }

        const result =
            await producer.publish(
                "criczone.live.ball-events",
                event
            )

        expect(kafkaProducer.send)
            .toHaveBeenCalledTimes(1)

        expect(result)
            .toEqual(brokerResult)
    })

    it("should send event to the correct topic", async () => {

        kafkaProducer.send.mockResolvedValue([])

        const event = {
            eventId: "event-1",
            type: "BALL_RECORDED",
            aggregateId: "match-1"
        }

        await producer.publish(
            "criczone.live.ball-events",
            event
        )

        expect(kafkaProducer.send)
            .toHaveBeenCalledWith(
                expect.objectContaining({
                    topic:
                        "criczone.live.ball-events"
                })
            )
    })

    it("should serialize event as JSON", async () => {

        kafkaProducer.send.mockResolvedValue([])

        const event = {
            eventId: "event-1",
            type: "BALL_RECORDED",
            aggregateId: "match-1"
        }

        await producer.publish(
            "criczone.live.ball-events",
            event
        )

        const sendCall =
            kafkaProducer.send.mock.calls[0][0]

        expect(
            sendCall.messages[0].value
        ).toBe(
            JSON.stringify(event)
        )
    })

    it("should use aggregateId as Kafka message key", async () => {

        kafkaProducer.send.mockResolvedValue([])

        const event = {
            eventId: "event-1",
            type: "BALL_RECORDED",
            aggregateId: "match-1"
        }

        await producer.publish(
            "criczone.live.ball-events",
            event
        )

        const sendCall =
            kafkaProducer.send.mock.calls[0][0]

        expect(
            sendCall.messages[0].key
        ).toBe("match-1")
    })

    it("should propagate Kafka send failure", async () => {

        const error =
            new Error("Kafka unavailable")

        kafkaProducer.send.mockRejectedValue(
            error
        )

        const event = {
            eventId: "event-1",
            type: "BALL_RECORDED",
            aggregateId: "match-1"
        }

        await expect(
            producer.publish(
                "criczone.live.ball-events",
                event
            )
        ).rejects.toThrow(
            "Kafka unavailable"
        )

        expect(logger.error)
            .toHaveBeenCalled()
    })
})

// DI — KafkaJS producer and logger are mocked dependencies.
// DIP — producer behavior is tested independently from the real broker.
// SRP — each test verifies one producer guarantee.
// Test Isolation — no real Kafka connection is required.
// Adapter Pattern — tests verify our KafkaEventProducer adapter.
// Fail-Fast/Error Propagation — broker failures must reach the caller.
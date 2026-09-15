import { describe, it, expect } from "vitest";
import { createTestKafka } from "../../helpers/testKafka.js";
import { createEvent } from "../../../src/messaging/EventFactory.js";

describe("Kafka Event Metadata Integration", () => {
    it("should preserve BALL_RECORDED event metadata", async () => {
        const kafka = createTestKafka()
        const producer = kafka.producer()
        const consumer = kafka.consumer({
            groupId: `criczone-test-metadata-${Date.now()}`
        })
        const event = createEvent({
             type: "BALL_RECORDED",
            aggregateId: "test-match-1003",
            payload: {
                matchId: 1003,
                inningsId: 2003,
                playerId: 3003,
                runs: 4,
                wicket: {
                    occurred: false
                }
            },
            requestId: "test-request-003",
            traceId: "test-trace-003"
        })

        let received = null
        let resolveMessage
        try {
            await producer.connect()
            await consumer.connect()

            await consumer.subscribe({
                topic: process.env.TEST_KAFKA_TOPIC,
                fromBeginning: false
            })

            const consumerReady = new Promise(resolve => {
                consumer.on(consumer.events.GROUP_JOIN, () => resolve())
            })

            const messageReceived = new Promise(resolve => {
                resolveMessage = resolve
            })
            consumer.run({
                eachMessage: async ({topic,
                    partition,
                    message
                }) => {
                    const parsedEvent = JSON.parse(message.value.toString())
                    if(parsedEvent.eventId === event.eventId)
                    {
                        received = {
                            topic,
                            partition,
                            offset: message.offset,
                            key: message.key?.toString(),
                            event: parsedEvent
                        }
                        resolveMessage()
                    }
                }
            })
            await consumerReady
            await producer.send({
                topic: process.env.TEST_KAFKA_TOPIC,
                messages: [
                    {
                        key: event.aggregateId,
                        value: JSON.stringify(event)
                    }
                ]
            })
            await Promise.race([
                messageReceived,
                new Promise((_,reject) => {
                    setTimeout(() => {
                        reject(new Error("Kafka metadata event was not received"))
                    }, 10000)
                })
            ])
            expect(received).toBeDefined()
            expect(received.topic).toBe(process.env.TEST_KAFKA_TOPIC)
            expect(received.partition).toBeGreaterThanOrEqual(0)
            expect(received.offset).toBeDefined()
            expect(received.key).toBe(event.aggregateId)
            expect(received.event.eventId).toBe(event.eventId)
            expect(received.event.type).toBe("BALL_RECORDED")
            expect(received.event.aggregateId).toBe("test-match-1003")
            expect(received.event.requestId).toBe("test-request-003")
            expect(received.event.traceId).toBe("test-trace-003")
            expect(received.event.timestamp).toBeDefined()
        }
        finally{
            await consumer.disconnect()
            await producer.disconnect()
        }

    }, 30000)
})

// SRP — Test verifies only Kafka/event metadata preservation.
// Factory Pattern — createTestKafka() centralizes Kafka test setup.
// Factory Function — createEvent() standardizes event creation.
// Encapsulation — Kafka connection details stay hidden.
// Observer Pattern — Consumer reacts to GROUP_JOIN and incoming messages.
// Separation of Concerns — Event creation, transport, metadata capture, and assertions are separate.
// DI — Kafka infrastructure is supplied independently.
// DIP — Test logic remains independent of broker/TLS/SASL details.
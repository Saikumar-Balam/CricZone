import {describe, it, expect} from "vitest"
import {createTestKafka} from "../../helpers/testKafka.js"
import {createEvent} from "../../../src/messaging/EventFactory.js"
describe("Kafka Serialization Integration", () => {
    it("should serialize and deserialize BALL_RECORDED event correctly", async () => {
        const kafka = createTestKafka()
        const producer = kafka.producer()
        const consumer = kafka.consumer({
            groupId: `criczone-test-serialization.${Date.now()}`
        })
        const event = createEvent({
            type: "BALL_RECORDED",
            aggregateId: "test-match-1004",
            payload: {
                matchId: 1004,
                inningsId: 2004,
                playerId: 3004,
                runs: 2,
                wicket: {
                    occurred: false
                }
            },
            requestId: "test-request-004",
            traceId: "test-request-004"
        })
        let deserializedEvent = null
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
            const messageReceived = new Promise(resolve =>{
                resolveMessage = resolve
            })
            consumer.run({
                eachMessage: async ({message}) => {
                    const eventString = message.value.toString()
                    const parsedEvent = JSON.parse(eventString)
                    if(parsedEvent.eventId === event.eventId)
                    {
                        deserializedEvent = parsedEvent
                        resolveMessage()
                    }
                }
            })
            await consumerReady
            const serializedEvent = JSON.stringify(event)
            await producer.send({
                topic: process.env.TEST_KAFKA_TOPIC,
                messages: [
                    {
                        key: event.aggregateId,
                        value: serializedEvent
                    }
                ]
            })
            await Promise.race([
                messageReceived,
                new Promise((__, reject) => {
                    setTimeout(() => {
                        reject(new Error("Serialized Kafka event was not received"))
                    }, 10000)
                })
            ])
            expect(deserializedEvent).toBeDefined()
            expect(deserializedEvent).toEqual(event)
            expect(deserializedEvent.payload).toEqual(event.payload)
            expect(deserializedEvent.eventId).toBe(event.eventId)
            expect(deserializedEvent.type).toBe("BALL_RECORDED")
            expect(deserializedEvent.aggregateId).toBe(event.aggregateId)
            expect(deserializedEvent.requestId).toBe(event.requestId)
            expect(deserializedEvent.traceId).toBe(event.traceId)
            expect(deserializedEvent.timestamp).toBe(event.timestamp)
        }
        finally {
            await consumer.disconnect()
            await producer.disconnect()
        }

    }, 30000)
})

// SRP — Test verifies only serialization/deserialization integrity.
// Factory Pattern — createTestKafka() centralizes Kafka client creation.
// Factory Function — createEvent() standardizes event construction.
// Encapsulation — Kafka connection/security configuration stays hidden.
// Observer Pattern — Consumer reacts to Kafka group and message events.
// Separation of Concerns — Creation, serialization, transport, deserialization, and validation are separated.
// DI — Kafka infrastructure is supplied independently.
// DIP — Test does not depend on low-level broker configuration.
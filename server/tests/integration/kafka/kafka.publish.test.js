import { describe, it, expect } from "vitest";
import { createTestKafka } from "../../helpers/testKafka.js";
import {createEvent} from "../../../src/messaging/EventFactory.js"

describe("Kafka Publish Integration", () => {
    it("should publish BALL_RECORDED event", async () => {
        const kafka = createTestKafka()
        const producer = kafka.producer()
        const event = createEvent({
            type: "BALL_RECORDED",
            aggregateId: "test:match-1001",
            payload: {
                matchId: 1001,
                inningsId: 2001,
                playerId: 3001,
                runs: 4,
                wicket:{
                    occurred: false,
                }
            },
                requestId: "test-request-001",
                traceId: "test-trace-001"
        })
        try {
            await producer.connect()
            const result = await producer.send({
                topic: process.env.TEST_KAFKA_TOPIC,
                messages: [
                    {
                        key: event.aggregateId,
                        value: JSON.stringify(event)
                    }
                ]
            })
            expect(result).toBeDefined()
            expect(result.length).toBeGreaterThan(0)
        }
        finally {
            await producer.disconnect()
        }
    }, 20000)
})

// SRP — Test verifies only publishing a Kafka event.
// Factory Pattern — createTestKafka() centralizes Kafka client creation.
// Factory Function — createEvent() centralizes event construction.
// Encapsulation — Kafka security/config details remain hidden.
// Separation of Concerns — Event creation, Kafka configuration, and publishing are separated.
// DI — Kafka instance is supplied independently to the test.
// DIP — Test logic is independent of low-level Kafka connection setup.
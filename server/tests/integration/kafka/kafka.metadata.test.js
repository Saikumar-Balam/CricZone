import { describe, it, expect } from "vitest";

import { createTestKafka, createTestKafkaProducer } from "../../helpers/testKafka.js";

import { createEvent } from "../../../src/messaging/EventFactory.js";

describe("Kafka Event Metadata Integration", () => {

    it("should preserve BALL_RECORDED event metadata", async () => {

        const kafka = createTestKafka();

        const producer = createTestKafkaProducer(kafka);

        const consumer = kafka.consumer({
            groupId: `criczone-test-metadata-${Date.now()}`
        });

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
        });

        let received = null;

        let resolveMessage;
        let rejectMessage;

        let timeout;

        try {

            await producer.connect();

            await consumer.connect();

            await consumer.subscribe({
                topic: process.env.TEST_KAFKA_TOPIC,
                fromBeginning: false
            });

            const consumerReady = new Promise((resolve) => {

                consumer.on(
                    consumer.events.GROUP_JOIN,
                    resolve
                );

            });

            const messageReceived = new Promise((resolve, reject) => {

                resolveMessage = resolve;
                rejectMessage = reject;

            });

            consumer.run({

                eachMessage: async ({
                    topic,
                    partition,
                    message
                }) => {

                    const parsedEvent =
                        JSON.parse(message.value.toString());

                    if (parsedEvent.eventId !== event.eventId) {
                        return;
                    }

                    received = {
                        topic,
                        partition,
                        offset: message.offset,
                        key: message.key?.toString(),
                        event: parsedEvent
                    };

                    clearTimeout(timeout);

                    resolveMessage();
                }

            });

            // Consumer must join the group before publishing.
            await consumerReady;

            // Delivery timeout starts only AFTER consumer readiness.
            timeout = setTimeout(() => {

                rejectMessage(
                    new Error(
                        "Kafka metadata event was not received within 20 seconds after consumer readiness"
                    )
                );

            }, 20000);

            await producer.send({
                topic: process.env.TEST_KAFKA_TOPIC,

                messages: [
                    {
                        key: event.aggregateId,
                        value: JSON.stringify(event)
                    }
                ]
            });

            await messageReceived;

            expect(received).toBeDefined();

            expect(received.topic)
                .toBe(process.env.TEST_KAFKA_TOPIC);

            expect(received.partition)
                .toBeGreaterThanOrEqual(0);

            expect(received.offset)
                .toBeDefined();

            expect(received.key)
                .toBe(event.aggregateId);

            expect(received.event.eventId)
                .toBe(event.eventId);

            expect(received.event.type)
                .toBe("BALL_RECORDED");

            expect(received.event.aggregateId)
                .toBe("test-match-1003");

            expect(received.event.requestId)
                .toBe("test-request-003");

            expect(received.event.traceId)
                .toBe("test-trace-003");

            expect(received.event.timestamp)
                .toBeDefined();

        }
        finally {

            if (timeout) {
                clearTimeout(timeout);
            }

            await consumer.disconnect();

            await producer.disconnect();

        }

    }, 45000);

});

// SRP — Test verifies only Kafka/event metadata preservation.
// Factory Pattern — createTestKafka() centralizes Kafka test setup.
// Factory Function — createEvent() standardizes event creation.
// Encapsulation — Kafka connection details stay hidden.
// Observer Pattern — Consumer reacts to GROUP_JOIN and incoming messages.
// Separation of Concerns — Event creation, transport, metadata capture, and assertions are separate.
// DI — Kafka infrastructure is supplied independently.
// DIP — Test logic remains independent of broker/TLS/SASL details.
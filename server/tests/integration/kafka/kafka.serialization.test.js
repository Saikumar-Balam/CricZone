import { describe, it, expect } from "vitest";

import { createTestKafka, createTestKafkaProducer } from "../../helpers/testKafka.js";

import { createEvent } from "../../../src/messaging/EventFactory.js";

describe("Kafka Serialization Integration", () => {

    it("should serialize and deserialize BALL_RECORDED event correctly", async () => {

        const kafka = createTestKafka();

        const producer = createTestKafkaProducer(kafka)

        const consumer = kafka.consumer({
            groupId: `criczone-test-serialization-${Date.now()}`
        });

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
            traceId: "test-trace-004"
        });

        try {

            await producer.connect();

            await consumer.connect();

            await consumer.subscribe({
                topic: process.env.TEST_KAFKA_TOPIC,
                fromBeginning: false
            });

            /**
             * Register GROUP_JOIN before consumer.run()
             * so consumer readiness cannot be missed.
             */
            const consumerReady = new Promise((resolve) => {

                consumer.on(
                    consumer.events.GROUP_JOIN,
                    resolve
                );

            });

            /**
             * Resolve the exact deserialized event directly
             * from the Kafka message handler.
             */
            let resolveMessage;
            let rejectMessage;

            const messageReceived = new Promise((resolve, reject) => {

                resolveMessage = resolve;
                rejectMessage = reject;

            });

            /**
             * Finite failure boundary for external Kafka
             * infrastructure.
             */
            const timeout = setTimeout(() => {

                rejectMessage(
                    new Error(
                        "Serialized Kafka event was not received"
                    )
                );

            }, 20000);

            /**
             * Start Kafka message processing.
             */
            consumer.run({

                eachMessage: async ({ message }) => {

                    const eventString =
                        message.value.toString();

                    const parsedEvent =
                        JSON.parse(eventString);

                    /**
                     * Other integration tests use the same topic.
                     * Ignore every event except this test's event.
                     */
                    if (parsedEvent.eventId !== event.eventId) {
                        return;
                    }

                    clearTimeout(timeout);

                    resolveMessage(parsedEvent);
                }

            });

            /**
             * Wait until Kafka assigns the consumer
             * its partition before publishing.
             */
            await consumerReady;

            const serializedEvent =
                JSON.stringify(event);

            await producer.send({

                topic: process.env.TEST_KAFKA_TOPIC,

                messages: [
                    {
                        key: event.aggregateId,
                        value: serializedEvent
                    }
                ]

            });

            /**
             * Receive the actual deserialized event through
             * the promise rather than shared mutable state.
             */
            const deserializedEvent =
                await messageReceived;

            expect(deserializedEvent).toBeDefined();

            expect(deserializedEvent).toEqual(event);

            expect(deserializedEvent.payload)
                .toEqual(event.payload);

            expect(deserializedEvent.eventId)
                .toBe(event.eventId);

            expect(deserializedEvent.type)
                .toBe("BALL_RECORDED");

            expect(deserializedEvent.aggregateId)
                .toBe(event.aggregateId);

            expect(deserializedEvent.requestId)
                .toBe(event.requestId);

            expect(deserializedEvent.traceId)
                .toBe(event.traceId);

            expect(deserializedEvent.timestamp)
                .toBe(event.timestamp);

        }
        finally {

            await producer.disconnect();

            await consumer.disconnect();

        }

    }, 45000);

});
// SRP — serialization test verifies Kafka serialization/deserialization only.
// Factory Pattern — createTestKafka() owns Kafka client construction.
// Factory Function — createEvent() owns event creation.
// Encapsulation — Kafka SSL/SASL configuration remains hidden.
// Separation of Concerns — readiness, transport, deserialization, and assertions remain separate.
// Deterministic Synchronization — GROUP_JOIN controls readiness instead of sleeps.
// Test Isolation — eventId distinguishes this test's event on the shared topic.
// Testability — the received event flows directly through the synchronization promise.
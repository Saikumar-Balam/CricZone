import { describe, it, expect } from "vitest";

import { createTestKafka } from "../../helpers/testKafka.js";

import { createEvent } from "../../../src/messaging/EventFactory.js";

describe("Kafka Consumer Receive Integration", () => {

    it("should receive published BALL_RECORDED event", async () => {

        const kafka = createTestKafka();

        const producer = kafka.producer();

        const consumer = kafka.consumer({
            groupId: `criczone-test-consumer-${Date.now()}`
        });

        const event = createEvent({
            type: "BALL_RECORDED",

            aggregateId: "test-match-1002",

            payload: {
                matchId: 1002,
                inningsId: 2002,
                playerId: 3002,
                runs: 6,

                wicket: {
                    occurred: false
                }
            },

            requestId: "test-request-002",
            traceId: "test-trace-002"
        });

        let timeout;

        let resolveMessage;
        let rejectMessage;

        try {

            await producer.connect();

            await consumer.connect();

            await consumer.subscribe({
                topic: process.env.TEST_KAFKA_TOPIC,
                fromBeginning: false
            });

            /*
             * Register GROUP_JOIN before consumer.run()
             * so consumer readiness cannot be missed.
             */
            const consumerReady = new Promise((resolve) => {

                consumer.on(
                    consumer.events.GROUP_JOIN,
                    resolve
                );

            });

            /*
             * Promise representing receipt of this test's
             * exact Kafka event.
             */
            const messageReceived = new Promise((resolve, reject) => {

                resolveMessage = resolve;
                rejectMessage = reject;

            });

            /*
             * Start Kafka message processing.
             *
             * Do not await consumer.run() because it remains
             * active until the consumer is stopped/disconnected.
             */
            consumer.run({

                eachMessage: async ({
                    topic,
                    partition,
                    message
                }) => {

                    const parsedEvent =
                        JSON.parse(message.value.toString());

                    /*
                     * Temporary diagnostic logging.
                     *
                     * This tells us whether the consumer is
                     * receiving:
                     *
                     * 1. our expected event,
                     * 2. unrelated events,
                     * 3. or no events at all.
                     */
                    console.log(
                        "Kafka test consumed event:",
                        {
                            expectedEventId:
                                event.eventId,

                            receivedEventId:
                                parsedEvent.eventId,

                            topic,

                            partition,

                            offset:
                                message.offset
                        }
                    );

                    /*
                     * Multiple Kafka integration tests use
                     * the same test topic.
                     *
                     * Ignore events that do not belong
                     * to this test.
                     */
                    if (
                        parsedEvent.eventId !==
                        event.eventId
                    ) {
                        return;
                    }

                    if (timeout) {
                        clearTimeout(timeout);
                    }

                    resolveMessage(parsedEvent);

                }

            });

            /*
             * Wait until Kafka has assigned the consumer
             * its partition before publishing.
             */
            await consumerReady;

            console.log(
                "Kafka consumer ready:",
                {
                    expectedEventId:
                        event.eventId,

                    topic:
                        process.env.TEST_KAFKA_TOPIC
                }
            );

            /*
             * Start timeout only AFTER consumer readiness.
             *
             * Therefore this measures Kafka message delivery,
             * not consumer startup.
             */
            timeout = setTimeout(() => {

                rejectMessage(
                    new Error(
                        "Kafka consumer did not receive event within 20 seconds after consumer readiness"
                    )
                );

            }, 20000);

            /*
             * Publish the event and capture Kafka's
             * acknowledgement metadata.
             */
            const sendResult = await producer.send({

                topic:
                    process.env.TEST_KAFKA_TOPIC,

                messages: [
                    {
                        key:
                            event.aggregateId,

                        value:
                            JSON.stringify(event)
                    }
                ]

            });

            /*
             * Temporary producer diagnostic.
             *
             * sendResult should tell us the partition
             * and offset assigned by Kafka.
             */
            console.log(
                "Kafka test produced event:",
                {
                    eventId:
                        event.eventId,

                    aggregateId:
                        event.aggregateId,

                    sendResult
                }
            );

            /*
             * Wait for the exact event produced above.
             */
            const receivedEvent =
                await messageReceived;

            expect(receivedEvent)
                .toBeDefined();

            expect(receivedEvent.eventId)
                .toBe(event.eventId);

            expect(receivedEvent.type)
                .toBe("BALL_RECORDED");

        }
        finally {

            /*
             * Ensure the timeout cannot remain alive
             * after the test completes or fails.
             */
            if (timeout) {
                clearTimeout(timeout);
            }

            /*
             * Stop long-running consumer first,
             * then disconnect producer.
             */
            await consumer.disconnect();

            await producer.disconnect();

        }

    }, 45000);

});

// SRP — Test verifies Kafka producer-to-consumer delivery only.

// Factory Pattern — createTestKafka() centralizes Kafka test client creation.

// Factory Function — createEvent() centralizes domain-event construction.

// Encapsulation — Kafka SSL/SASL configuration remains inside createTestKafka().

// Separation of Concerns — Readiness, publishing, consuming, diagnostics,
// assertions, and cleanup remain separate phases.

// Deterministic Synchronization — GROUP_JOIN establishes consumer readiness
// before the event is published.

// Test Isolation — Unique consumer group and eventId prevent unrelated
// Kafka events from satisfying the test.

// Resource Lifecycle Management — Timeout, consumer, and producer
// are explicitly cleaned up.

// Observability — Producer acknowledgement and consumer offset metadata
// expose the exact Kafka delivery path.

// Reliability — A finite timeout prevents external Kafka infrastructure
// from hanging the test indefinitely.
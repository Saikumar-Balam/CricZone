import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

import {
    createTestKafka,
    createTestKafkaProducer
} from "../../helpers/testKafka.js";

import {
    createEvent
} from "../../../src/messaging/EventFactory.js";


describe("Kafka Event Metadata Integration", () => {

    it(
        "should preserve BALL_RECORDED event metadata",
        async () => {

            const testId = randomUUID();

            const kafka = createTestKafka();

            const producer =
                createTestKafkaProducer(kafka);

            const consumer = kafka.consumer({
                groupId:
                    `criczone-test-metadata-${testId}`
            });

            const aggregateId =
                `test-match-${testId}`;

            const requestId =
                `test-request-${testId}`;

            const traceId =
                `test-trace-${testId}`;

            const event = createEvent({
                type: "BALL_RECORDED",

                aggregateId,

                payload: {
                    matchId: `match-${testId}`,
                    inningsId: `innings-${testId}`,
                    playerId: `player-${testId}`,
                    runs: 4,

                    wicket: {
                        occurred: false
                    }
                },

                requestId,
                traceId
            });

            let received = null;

            let resolveMessage;
            let rejectMessage;
            let timeout;

            try {

                await producer.connect();
                await consumer.connect();

                await consumer.subscribe({
                    topic:
                        process.env.TEST_KAFKA_TOPIC,

                    fromBeginning: true
                });

                /*
                 * Register GROUP_JOIN listener
                 * before starting the consumer.
                 */
                const consumerReady =
                    new Promise((resolve) => {

                        consumer.on(
                            consumer.events.GROUP_JOIN,
                            resolve
                        );

                    });

                const messageReceived =
                    new Promise(
                        (resolve, reject) => {

                            resolveMessage = resolve;
                            rejectMessage = reject;

                        }
                    );

                /*
                 * Start consumer.
                 */
                const consumerRun =
                    consumer.run({

                        eachMessage: async ({
                            topic,
                            partition,
                            message
                        }) => {

                            const parsedEvent =
                                JSON.parse(
                                    message.value.toString()
                                );

                            /*
                             * Ignore events belonging
                             * to other concurrent tests.
                             */
                            if (
                                parsedEvent.eventId !==
                                event.eventId
                            ) {
                                return;
                            }

                            received = {
                                topic,
                                partition,
                                offset:
                                    message.offset,

                                key:
                                    message.key
                                        ?.toString(),

                                event:
                                    parsedEvent
                            };

                            if (timeout) {
                                clearTimeout(timeout);
                            }

                            resolveMessage();
                        }
                    });

                /*
                 * Consumer must have joined its
                 * consumer group before publishing.
                 */
                await consumerReady;

                /*
                 * Delivery timeout begins only after
                 * consumer readiness.
                 */
                timeout = setTimeout(() => {

                    rejectMessage(
                        new Error(
                            "Kafka metadata event was not received within 20 seconds after consumer readiness"
                        )
                    );

                }, 20000);

                /*
                 * Publish the exact event this
                 * consumer is waiting for.
                 */
                await producer.send({
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

                await messageReceived;

                expect(received)
                    .toBeDefined();

                expect(received.topic)
                    .toBe(
                        process.env.TEST_KAFKA_TOPIC
                    );

                expect(received.partition)
                    .toBeGreaterThanOrEqual(0);

                expect(received.offset)
                    .toBeDefined();

                expect(received.key)
                    .toBe(aggregateId);

                expect(received.event.eventId)
                    .toBe(event.eventId);

                expect(received.event.type)
                    .toBe("BALL_RECORDED");

                expect(
                    received.event.aggregateId
                ).toBe(aggregateId);

                expect(
                    received.event.requestId
                ).toBe(requestId);

                expect(
                    received.event.traceId
                ).toBe(traceId);

                expect(
                    received.event.timestamp
                ).toBeDefined();

                /*
                 * Keep reference so consumer.run()
                 * is not treated as an accidental
                 * unhandled promise.
                 */
                void consumerRun;

            }
            finally {

                if (timeout) {
                    clearTimeout(timeout);
                }

                await Promise.allSettled([
                    consumer.disconnect(),
                    producer.disconnect()
                ]);
            }

        },
        45000
    );

});

// SRP — Test verifies only Kafka/event metadata preservation.
// Factory Pattern — createTestKafka() centralizes Kafka test setup.
// Factory Function — createEvent() standardizes event creation.
// Encapsulation — Kafka connection details stay hidden.
// Observer Pattern — Consumer reacts to GROUP_JOIN and incoming messages.
// Separation of Concerns — Event creation, transport, metadata capture, and assertions are separate.
// DI — Kafka infrastructure is supplied independently.
// DIP — Test logic remains independent of broker/TLS/SASL details.
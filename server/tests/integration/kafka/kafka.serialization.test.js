import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

import {
    createTestKafka,
    createTestKafkaProducer
} from "../../helpers/testKafka.js";

import {
    createEvent
} from "../../../src/messaging/EventFactory.js";


describe("Kafka Serialization Integration", () => {

    it(
        "should serialize and deserialize BALL_RECORDED event correctly",
        async () => {

            const testId = randomUUID();

            const kafka =
                createTestKafka();

            const producer =
                createTestKafkaProducer(kafka);

            const consumer =
                kafka.consumer({
                    groupId:
                        `criczone-test-serialization-${testId}`
                });


            const event =
                createEvent({

                    type:
                        "BALL_RECORDED",

                    aggregateId:
                        `test-match-${testId}`,

                    payload: {

                        matchId:
                            `match-${testId}`,

                        inningsId:
                            `innings-${testId}`,

                        playerId:
                            `player-${testId}`,

                        runs: 2,

                        wicket: {
                            occurred: false
                        }
                    },

                    requestId:
                        `test-request-${testId}`,

                    traceId:
                        `test-trace-${testId}`
                });


            let timeout = null;

            let resolveMessage;
            let rejectMessage;


            const messageReceived =
                new Promise(
                    (resolve, reject) => {

                        resolveMessage =
                            resolve;

                        rejectMessage =
                            reject;
                    }
                );


            try {

                await producer.connect();

                await consumer.connect();


                await consumer.subscribe({

                    topic:
                        process.env.TEST_KAFKA_TOPIC,

                    /*
                     * Shared integration-test topic.
                     *
                     * Historical events are safe because
                     * this test accepts only its unique
                     * eventId.
                     */
                    fromBeginning: true
                });


                /*
                 * Register readiness listener before
                 * starting consumer.run().
                 */
                const consumerReady =
                    new Promise(resolve => {

                        consumer.on(
                            consumer.events.GROUP_JOIN,
                            resolve
                        );
                    });


                const runPromise =
                    consumer.run({

                        eachMessage:
                            async ({ message }) => {

                                const eventString =
                                    message.value.toString();

                                const parsedEvent =
                                    JSON.parse(
                                        eventString
                                    );


                                if (
                                    parsedEvent.eventId !==
                                    event.eventId
                                ) {
                                    return;
                                }


                                if (timeout) {
                                    clearTimeout(
                                        timeout
                                    );
                                }


                                resolveMessage(
                                    parsedEvent
                                );
                            }
                    });


                /*
                 * Consumer must first receive
                 * its partition assignment.
                 */
                await consumerReady;


                /*
                 * IMPORTANT:
                 *
                 * Timeout starts AFTER readiness.
                 * Consumer startup time therefore
                 * does not count as delivery time.
                 */
                timeout =
                    setTimeout(() => {

                        rejectMessage(
                            new Error(
                                "Serialized Kafka event was not received within 20 seconds after consumer readiness"
                            )
                        );

                    }, 20000);


                const serializedEvent =
                    JSON.stringify(event);


                await producer.send({

                    topic:
                        process.env.TEST_KAFKA_TOPIC,

                    messages: [
                        {
                            key:
                                event.aggregateId,

                            value:
                                serializedEvent
                        }
                    ]
                });


                const deserializedEvent =
                    await messageReceived;


                expect(deserializedEvent)
                    .toBeDefined();

                expect(deserializedEvent)
                    .toEqual(event);

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


                void runPromise;

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


// SRP — Test verifies Kafka serialization/deserialization only.
// Factory Pattern — createTestKafka() owns Kafka client construction.
// Factory Function — createEvent() owns event construction.
// Encapsulation — Kafka infrastructure configuration remains in the test factory.
// Separation of Concerns — transport, serialization, synchronization, and assertions remain separate.
// Deterministic Synchronization — consumer readiness occurs before publishing.
// Test Isolation — unique groupId and eventId isolate this test.
// Resource Lifecycle Management — timeout and Kafka resources are always cleaned up.
// SRP — serialization test verifies Kafka serialization/deserialization only.
// Factory Pattern — createTestKafka() owns Kafka client construction.
// Factory Function — createEvent() owns event creation.
// Encapsulation — Kafka SSL/SASL configuration remains hidden.
// Separation of Concerns — readiness, transport, deserialization, and assertions remain separate.
// Deterministic Synchronization — GROUP_JOIN controls readiness instead of sleeps.
// Test Isolation — eventId distinguishes this test's event on the shared topic.
// Testability — the received event flows directly through the synchronization promise.
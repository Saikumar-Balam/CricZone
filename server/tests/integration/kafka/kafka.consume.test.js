import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";

import {
    createTestKafka,
    createTestKafkaProducer
} from "../../helpers/testKafka.js";

import {
    createEvent
} from "../../../src/messaging/EventFactory.js";


describe("Kafka Consumer Receive Integration", () => {

    it(
        "should receive published BALL_RECORDED event",
        async () => {

            const testId = randomUUID();

            const kafka = createTestKafka();

            const producer =
                createTestKafkaProducer(kafka);

            const consumer = kafka.consumer({
                groupId:
                    `criczone-test-consumer-${testId}`
            });

            const event = createEvent({
                type: "BALL_RECORDED",

                aggregateId:
                    `test-match-${testId}`,

                payload: {
                    matchId:
                        `match-${testId}`,

                    inningsId:
                        `innings-${testId}`,

                    playerId:
                        `player-${testId}`,

                    runs: 6,

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

            try {

                await producer.connect();
                await consumer.connect();

                await consumer.subscribe({
                    topic:
                        process.env.TEST_KAFKA_TOPIC,

                    /*
                     * Unique consumer group +
                     * unique eventId makes old
                     * records safe to consume.
                     */
                    fromBeginning: true
                });


                let resolveMessage;
                let rejectMessage;

                const messageReceived =
                    new Promise(
                        (resolve, reject) => {

                            resolveMessage = resolve;
                            rejectMessage = reject;

                        }
                    );


                /*
                 * Register readiness listener
                 * BEFORE consumer.run().
                 */
                const consumerReady =
                    new Promise((resolve) => {

                        consumer.on(
                            consumer.events.GROUP_JOIN,
                            resolve
                        );

                    });


                /*
                 * Start Kafka consumer loop.
                 */
                const runPromise =
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
                             * Shared test topic can
                             * contain records from
                             * previous tests.
                             */
                            if (
                                parsedEvent.eventId !==
                                event.eventId
                            ) {
                                return;
                            }

                            console.log(
                                "Kafka exact test event received:",
                                {
                                    eventId:
                                        parsedEvent.eventId,

                                    topic,

                                    partition,

                                    offset:
                                        message.offset
                                }
                            );

                            if (timeout) {
                                clearTimeout(timeout);
                            }

                            resolveMessage(
                                parsedEvent
                            );
                        }
                    });


                /*
                 * Wait for partition assignment.
                 */
                await consumerReady;


                /*
                 * Start delivery timeout after
                 * consumer group readiness.
                 */
                timeout = setTimeout(() => {

                    rejectMessage(
                        new Error(
                            "Kafka consumer did not receive exact test event within 20 seconds"
                        )
                    );

                }, 20000);


                const sendResult =
                    await producer.send({

                        topic:
                            process.env.TEST_KAFKA_TOPIC,

                        messages: [
                            {
                                key:
                                    event.aggregateId,

                                value:
                                    JSON.stringify(
                                        event
                                    )
                            }
                        ]
                    });


                console.log(
                    "Kafka exact test event produced:",
                    {
                        eventId:
                            event.eventId,

                        sendResult
                    }
                );


                const receivedEvent =
                    await messageReceived;


                expect(receivedEvent)
                    .toBeDefined();

                expect(receivedEvent.eventId)
                    .toBe(event.eventId);

                expect(receivedEvent.type)
                    .toBe("BALL_RECORDED");

                expect(receivedEvent.aggregateId)
                    .toBe(event.aggregateId);


                /*
                 * consumer.run() intentionally
                 * remains active until disconnect.
                 */
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
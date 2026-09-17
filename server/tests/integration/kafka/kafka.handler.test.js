import { describe, it, vi, expect } from "vitest";

import { createTestKafka } from "../../helpers/testKafka.js";

import LiveBallEventHandler from "../../../src/messaging/handlers/LiveBallEventHandler.js";

import { createEvent } from "../../../src/messaging/EventFactory.js";

describe("Kafka Handler Invocation Integration", () => {

    it("should invoke LiveBallEventHandler for BALL_RECORDED", async () => {

        const kafka = createTestKafka();

        const producer = kafka.producer();

        const consumer = kafka.consumer({
            groupId: `criczone-test-handler-${Date.now()}`
        });

        const liveUpdateService = {
            processBallRecorded: vi.fn().mockResolvedValue(undefined)
        };

        const logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        };

        const handler = new LiveBallEventHandler(
            liveUpdateService,
            logger
        );

        const event = createEvent({
            type: "BALL_RECORDED",

            aggregateId: "test-match-1005",

            payload: {
                matchId: 1005,
                inningsId: 2005,
                inningsNumber: 1,
                overNumber: 10,
                ballNumber: 3,
                strikerId: 3005,
                nonStrikerId: 3006,
                bowlerId: 4001,
                runs: 4,
                extras: 0,
                boundary: true,

                wicket: {
                    occurred: false
                },

                legalDelivery: true
            },

            requestId: "test-request-005",
            traceId: "test-trace-005"
        });

        let resolveHandler;
        let rejectHandler;

        let timeout;

        const handlerInvoked = new Promise((resolve, reject) => {

            resolveHandler = resolve;
            rejectHandler = reject;

        });

        try {

            await producer.connect();

            await consumer.connect();

            await consumer.subscribe({
                topic: process.env.TEST_KAFKA_TOPIC,
                fromBeginning: false
            });

            /*
             * Register readiness listener before consumer.run()
             * so GROUP_JOIN cannot be missed.
             */
            const consumerReady = new Promise((resolve) => {

                consumer.on(
                    consumer.events.GROUP_JOIN,
                    resolve
                );

            });

            /*
             * Start the long-running Kafka consumer.
             * Do not await consumer.run().
             */
            consumer.run({

                eachMessage: async ({
                    topic,
                    partition,
                    message
                }) => {

                    const receivedEvent =
                        JSON.parse(message.value.toString());

                    /*
                     * Other integration tests may use the same
                     * Kafka topic. Process only this test's event.
                     */
                    if (receivedEvent.eventId !== event.eventId) {
                        return;
                    }

                    const metadata = {
                        topic,
                        partition,
                        offset: message.offset
                    };

                    try {

                        await handler.handle(
                            receivedEvent,
                            metadata
                        );

                        clearTimeout(timeout);

                        resolveHandler();

                    }
                    catch (error) {

                        clearTimeout(timeout);

                        rejectHandler(error);

                    }

                }

            });

            /*
             * Kafka partition assignment establishes
             * consumer readiness.
             */
            await consumerReady;

            /*
             * Start delivery timeout only after the
             * consumer has joined its group.
             */
            timeout = setTimeout(() => {

                rejectHandler(
                    new Error(
                        "LiveBallEventHandler was not invoked within 20 seconds after consumer readiness"
                    )
                );

            }, 20000);

            /*
             * Publish only after consumer readiness.
             */
            await producer.send({
                topic: process.env.TEST_KAFKA_TOPIC,

                messages: [
                    {
                        key: event.aggregateId,
                        value: JSON.stringify(event)
                    }
                ]
            });

            await handlerInvoked;

            expect(
                liveUpdateService.processBallRecorded
            ).toHaveBeenCalledTimes(1);

            expect(
                liveUpdateService.processBallRecorded
            ).toHaveBeenCalledWith(event);

            expect(
                logger.info
            ).toHaveBeenCalledTimes(1);

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

// SRP — Test verifies Kafka-to-handler invocation only.
// Dependency Injection — liveUpdateService and logger are injected.
// DIP — Handler depends on supplied collaborators rather than infrastructure.
// Delegation — Handler delegates business processing to LiveUpdateService.
// Service Layer — Business workflow remains inside LiveUpdateService.
// Separation of Concerns — Kafka delivery, handler execution, and assertions are separate.
// Deterministic Synchronization — GROUP_JOIN establishes consumer readiness.
// Resource Lifecycle Management — Timeout, consumer, and producer are explicitly cleaned up.
// Test Isolation — Unique consumer group and eventId isolate this test.
// Testability — Injected dependencies are independently mockable.
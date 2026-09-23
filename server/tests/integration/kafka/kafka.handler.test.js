import {
    describe,
    it,
    vi,
    expect
} from "vitest"

import {
    randomUUID
} from "node:crypto"

import {
    createTestKafka,
    createTestKafkaProducer
} from "../../helpers/testKafka.js"

import LiveBallEventHandler
    from "../../../src/messaging/handlers/LiveBallEventHandler.js"

import {
    createEvent
} from "../../../src/messaging/EventFactory.js"


describe("Kafka Handler Invocation Integration", () => {

    it(
        "should invoke LiveBallEventHandler for BALL_RECORDED",
        async () => {

            const kafka =
                createTestKafka()


            const producer =
                createTestKafkaProducer(kafka)


            const consumer =
                kafka.consumer({
                    groupId:
                        `criczone-test-handler-${randomUUID()}`
                })


            const liveUpdateService = {

                processBallRecorded:
                    vi.fn()
                        .mockResolvedValue(
                            undefined
                        )

            }


            const logger = {

                info:
                    vi.fn(),

                warn:
                    vi.fn(),

                error:
                    vi.fn()

            }


            const handler =
                new LiveBallEventHandler(
                    liveUpdateService,
                    logger
                )


            const event =
                createEvent({

                    type:
                        "BALL_RECORDED",

                    aggregateId:
                        "test-match-1005",

                    payload: {

                        matchId:
                            1005,

                        inningsId:
                            2005,

                        inningsNumber:
                            1,

                        overNumber:
                            10,

                        ballNumber:
                            3,

                        strikerId:
                            3005,

                        nonStrikerId:
                            3006,

                        bowlerId:
                            4001,

                        runs:
                            4,

                        extras:
                            0,

                        boundary:
                            true,

                        wicket: {
                            occurred:
                                false
                        },

                        legalDelivery:
                            true
                    },

                    requestId:
                        "test-request-005",

                    traceId:
                        "test-trace-005"
                })


            let resolveHandler
            let rejectHandler
            let timeout


            const handlerInvoked =
                new Promise(
                    (resolve, reject) => {

                        resolveHandler =
                            resolve

                        rejectHandler =
                            reject
                    }
                )


            try {

                /*
                 * Connect Kafka resources.
                 */

                await producer.connect()

                await consumer.connect()


                /*
                 * Subscribe before starting consumer.
                 */

                await consumer.subscribe({

                    topic:
                        process.env.TEST_KAFKA_TOPIC,

                    fromBeginning:
                        false
                })


                /*
                 * Register GROUP_JOIN before consumer.run()
                 * so readiness cannot be missed.
                 */

                const consumerReady =
                    new Promise(resolve => {

                        consumer.on(
                            consumer.events.GROUP_JOIN,
                            resolve
                        )
                    })


                /*
                 * Start Kafka message processing.
                 *
                 * consumer.run() is long-running,
                 * therefore we intentionally do not await it.
                 */

                consumer.run({

                    eachMessage:
                        async ({
                            topic,
                            partition,
                            message
                        }) => {

                            const receivedEvent =
                                JSON.parse(
                                    message.value.toString()
                                )


                            /*
                             * Multiple integration tests use
                             * the same Kafka test topic.
                             *
                             * Ignore every event except the exact
                             * event created by this test.
                             */

                            if (
                                receivedEvent.eventId !==
                                event.eventId
                            ) {
                                return
                            }


                            const metadata = {

                                topic,

                                partition,

                                offset:
                                    message.offset
                            }


                            try {

                                /*
                                 * Exact expected Kafka event has
                                 * reached this consumer.
                                 */

                                await handler.handle(
                                    receivedEvent,
                                    metadata
                                )


                                if (timeout) {
                                    clearTimeout(
                                        timeout
                                    )
                                }


                                resolveHandler()

                            }
                            catch (error) {

                                if (timeout) {
                                    clearTimeout(
                                        timeout
                                    )
                                }


                                rejectHandler(
                                    error
                                )
                            }
                        }
                })


                /*
                 * Wait until Kafka has assigned the consumer
                 * its partition.
                 */

                await consumerReady


                


                /*
                 * Start delivery timeout only AFTER
                 * consumer readiness.
                 */

                timeout =
                    setTimeout(() => {

                        rejectHandler(
                            new Error(
                                "LiveBallEventHandler was not invoked within 20 seconds after consumer readiness"
                            )
                        )

                    }, 20000)


                /*
                 * Publish this test's exact event.
                 */

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
                    })


                /*
                 * Verify Kafka acknowledged the publish.
                 */

                expect(
                    sendResult
                ).toBeDefined()


                expect(
                    sendResult.length
                ).toBeGreaterThan(0)


                expect(
                    sendResult[0].errorCode
                ).toBe(0)


                /*
                 * Wait until this exact Kafka event reaches
                 * LiveBallEventHandler.
                 */

                await handlerInvoked


                /*
                 * Verify handler delegation.
                 */

                expect(
                    liveUpdateService
                        .processBallRecorded
                ).toHaveBeenCalledTimes(1)


                expect(
                    liveUpdateService
                        .processBallRecorded
                ).toHaveBeenCalledWith(
                    event
                )


                expect(
                    logger.info
                ).toHaveBeenCalledTimes(1)

            }
            finally {

                /*
                 * Ensure timeout cannot remain alive after
                 * success or failure.
                 */

                if (timeout) {
                    clearTimeout(
                        timeout
                    )
                }


                /*
                 * Release Kafka resources.
                 */

                await consumer.disconnect()

                await producer.disconnect()
            }

        },
        45000
    )

})


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
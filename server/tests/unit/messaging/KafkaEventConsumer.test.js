import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import KafkaEventConsumer
    from "../../../src/messaging/KafkaEventConsumer.js"


describe("KafkaEventConsumer", () => {

    let kafkaConsumer
    let logger
    let metrics
    let retryStrategy
    let idempotencyStore
    let deadLetterPublisher
    let consumer


    beforeEach(() => {

        kafkaConsumer = {
            connect:
                vi.fn()
                    .mockResolvedValue(undefined),

            subscribe:
                vi.fn()
                    .mockResolvedValue(undefined),

            run:
                vi.fn()
                    .mockResolvedValue(undefined),

            disconnect:
                vi.fn()
                    .mockResolvedValue(undefined)
        }


        logger = {
            info:
                vi.fn(),

            warn:
                vi.fn(),

            error:
                vi.fn()
        }


        metrics = {
            incrementCounter:
                vi.fn(),

            observeHistogram:
                vi.fn()
        }


        retryStrategy = {
            execute:
                vi.fn(
                    async (operation) =>
                        await operation()
                )
        }


        /*
         * Default:
         * every event is considered new.
         */
        idempotencyStore = {
            claim:
                vi.fn()
                    .mockResolvedValue(true),

            release:
                vi.fn()
                    .mockResolvedValue(undefined)
        }


        /*
         * Default:
         * dead-letter publication succeeds.
         */
        deadLetterPublisher = {
            publish:
                vi.fn()
                    .mockResolvedValue({
                        success: true
                    })
        }


        consumer =
            new KafkaEventConsumer(
                kafkaConsumer,
                logger,
                metrics,
                retryStrategy,
                idempotencyStore,
                deadLetterPublisher
            )
    })


    const getEachMessage =
        async (
            topic =
                "criczone.live-events",
            handler =
                vi.fn()
        ) => {

            await consumer.subscribe(
                topic,
                handler
            )

            return kafkaConsumer.run
                .mock.calls[0][0]
                .eachMessage
        }


    const createKafkaMessage = ({
        event,
        offset = "1",
        key = null,
        topic = "criczone.live-events",
        partition = 0
    }) => ({
        topic,
        partition,

        message: {
            value:
                event === null
                    ? null
                    : Buffer.from(
                        typeof event === "string"
                            ? event
                            : JSON.stringify(event)
                    ),

            offset,

            key:
                key === null
                    ? null
                    : Buffer.from(key)
        }
    })


    /*
     * CONNECTION
     */

    it("should connect Kafka consumer", async () => {

        await consumer.connect()

        expect(
            kafkaConsumer.connect
        ).toHaveBeenCalledTimes(1)

        expect(
            logger.info
        ).toHaveBeenCalledWith(
            "Kafka consumer connected"
        )
    })


    it("should propagate connection failure", async () => {

        const error =
            new Error(
                "connection failed"
            )

        kafkaConsumer.connect
            .mockRejectedValue(error)


        await expect(
            consumer.connect()
        ).rejects.toThrow(
            "connection failed"
        )


        expect(
            logger.error
        ).toHaveBeenCalled()
    })


    /*
     * NORMAL EVENT PROCESSING
     */

    it("should subscribe and process valid event", async () => {

        const handler =
            vi.fn()
                .mockResolvedValue(undefined)


        const event = {
            eventId:
                "event-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        kafkaConsumer.run
            .mockImplementation(
                async ({
                    eachMessage
                }) => {

                    await eachMessage(
                        createKafkaMessage({
                            event,
                            offset:
                                "10",
                            key:
                                "match-1"
                        })
                    )
                }
            )


        await consumer.subscribe(
            "criczone.live-events",
            handler
        )


        expect(
            kafkaConsumer.subscribe
        ).toHaveBeenCalledWith({
            topic:
                "criczone.live-events",

            fromBeginning:
                false
        })


        expect(
            idempotencyStore.claim
        ).toHaveBeenCalledWith(
            "event-1"
        )


        expect(
            retryStrategy.execute
        ).toHaveBeenCalledTimes(1)


        expect(
            handler
        ).toHaveBeenCalledWith(
            event,
            {
                topic:
                    "criczone.live-events",

                partition:
                    0,

                offset:
                    "10",

                key:
                    "match-1"
            }
        )


        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()


        expect(
            metrics.incrementCounter
        ).toHaveBeenCalledWith(
            "kafka_events_consumed_total",
            1,
            {
                topic:
                    "criczone.live-events",

                event_type:
                    "BALL_RECORDED"
            }
        )


        expect(
            metrics.observeHistogram
        ).toHaveBeenCalled()
    })


    /*
     * VALIDATION
     */

    it("should reject empty Kafka message without retrying", async () => {

        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event:
                        null,
                    offset:
                        "11"
                })
            )
        ).rejects.toThrow(
            "Kafka message value is empty"
        )


        expect(
            idempotencyStore.claim
        ).not.toHaveBeenCalled()

        expect(
            retryStrategy.execute
        ).not.toHaveBeenCalled()

        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()


        expect(
            metrics.incrementCounter
        ).toHaveBeenCalledWith(
            "kafka_event_failures_total",
            1,
            {
                topic:
                    "criczone.live-events"
            }
        )
    })


    it("should reject invalid JSON without retrying", async () => {

        const handler =
            vi.fn()

        const eachMessage =
            await getEachMessage(
                "criczone.live-events",
                handler
            )


        await expect(
            eachMessage(
                createKafkaMessage({
                    event:
                        "{invalid-json",
                    offset:
                        "12"
                })
            )
        ).rejects.toThrow()


        expect(
            idempotencyStore.claim
        ).not.toHaveBeenCalled()

        expect(
            retryStrategy.execute
        ).not.toHaveBeenCalled()

        expect(
            handler
        ).not.toHaveBeenCalled()

        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()

        expect(
            logger.error
        ).toHaveBeenCalled()
    })


    it("should reject event without type without retrying", async () => {

        const event = {
            eventId:
                "event-2"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "13"
                })
            )
        ).rejects.toThrow(
            "Kafka event type is required"
        )


        expect(
            idempotencyStore.claim
        ).not.toHaveBeenCalled()

        expect(
            retryStrategy.execute
        ).not.toHaveBeenCalled()

        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()
    })


    it("should reject event without eventId without retrying", async () => {

        const event = {
            type:
                "BALL_RECORDED"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "14"
                })
            )
        ).rejects.toThrow(
            "Kafka eventId is required"
        )


        expect(
            idempotencyStore.claim
        ).not.toHaveBeenCalled()

        expect(
            retryStrategy.execute
        ).not.toHaveBeenCalled()

        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()
    })


    /*
     * RETRY STRATEGY
     */

    it("should process handler through retry strategy", async () => {

        const handler =
            vi.fn()
                .mockResolvedValue(undefined)


        const event = {
            eventId:
                "event-retry-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage(
                "criczone.live-events",
                handler
            )


        await eachMessage(
            createKafkaMessage({
                event,
                offset:
                    "15",
                key:
                    "match-1"
            })
        )


        expect(
            idempotencyStore.claim
        ).toHaveBeenCalledWith(
            "event-retry-1"
        )


        expect(
            retryStrategy.execute
        ).toHaveBeenCalledTimes(1)


        expect(
            handler
        ).toHaveBeenCalledTimes(1)


        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()
    })


    it("should move event to DLQ when retry strategy is exhausted", async () => {

        const processingError =
            new Error(
                "handler failed after retries"
            )


        retryStrategy.execute
            .mockRejectedValue(
                processingError
            )


        const event = {
            eventId:
                "event-retry-2",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "16",
                    key:
                        "match-1"
                })
            )
        ).resolves.toBeUndefined()


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledWith(
            event,
            {
                topic:
                    "criczone.live-events",

                partition:
                    0,

                offset:
                    "16",

                key:
                    "match-1"
            },
            processingError
        )


        expect(
            idempotencyStore.release
        ).not.toHaveBeenCalled()
    })


    it("should move handler failure to DLQ after retry strategy exhausts", async () => {

        const handlerError =
            new Error(
                "handler failed"
            )


        retryStrategy.execute
            .mockRejectedValue(
                handlerError
            )


        const event = {
            eventId:
                "event-3",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-3"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "17",
                    key:
                        "match-3"
                })
            )
        ).resolves.toBeUndefined()


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledWith(
            event,
            expect.objectContaining({
                offset:
                    "17",

                key:
                    "match-3"
            }),
            handlerError
        )


        expect(
            idempotencyStore.release
        ).not.toHaveBeenCalled()
    })


    /*
     * STEP 20.6
     * OFFSET / ACKNOWLEDGEMENT STRATEGY
     */

    it("should run consumer with auto commit enabled", async () => {

        await consumer.subscribe(
            "criczone.live-events",
            vi.fn()
        )


        expect(
            kafkaConsumer.run
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                autoCommit:
                    true,

                eachMessage:
                    expect.any(Function)
            })
        )
    })


    it("should complete message processing after handler succeeds", async () => {

        const handler =
            vi.fn()
                .mockResolvedValue(undefined)


        const event = {
            eventId:
                "event-offset-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage(
                "criczone.live-events",
                handler
            )


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "100",
                    key:
                        "match-1"
                })
            )
        ).resolves.toBeUndefined()


        expect(
            handler
        ).toHaveBeenCalledTimes(1)


        expect(
            retryStrategy.execute
        ).toHaveBeenCalledTimes(1)


        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()
    })


    it("should complete message processing after exhausted event is safely dead-lettered", async () => {

        const processingError =
            new Error(
                "processing failed"
            )


        retryStrategy.execute
            .mockRejectedValue(
                processingError
            )


        const event = {
            eventId:
                "event-offset-2",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "101",
                    key:
                        "match-1"
                })
            )
        ).resolves.toBeUndefined()


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledTimes(1)


        expect(
            idempotencyStore.release
        ).not.toHaveBeenCalled()
    })


    /*
     * STEP 20.7
     * IDEMPOTENT EVENT PROCESSING
     */

    it("should claim event before processing", async () => {

        const handler =
            vi.fn()
                .mockResolvedValue(undefined)


        const event = {
            eventId:
                "event-idempotency-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage(
                "criczone.live-events",
                handler
            )


        await eachMessage(
            createKafkaMessage({
                event,
                offset:
                    "200",
                key:
                    "match-1"
            })
        )


        expect(
            idempotencyStore.claim
        ).toHaveBeenCalledWith(
            "event-idempotency-1"
        )


        expect(
            handler
        ).toHaveBeenCalledTimes(1)


        expect(
            idempotencyStore.claim
                .mock.invocationCallOrder[0]
        ).toBeLessThan(
            handler.mock.invocationCallOrder[0]
        )
    })


    it("should skip duplicate event when claim fails", async () => {

        idempotencyStore.claim
            .mockResolvedValue(false)


        const handler =
            vi.fn()


        const event = {
            eventId:
                "event-duplicate-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage(
                "criczone.live-events",
                handler
            )


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "201",
                    key:
                        "match-1"
                })
            )
        ).resolves.toBeUndefined()


        expect(
            idempotencyStore.claim
        ).toHaveBeenCalledWith(
            "event-duplicate-1"
        )


        expect(
            handler
        ).not.toHaveBeenCalled()


        expect(
            retryStrategy.execute
        ).not.toHaveBeenCalled()


        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()


        expect(
            metrics.incrementCounter
        ).toHaveBeenCalledWith(
            "kafka_duplicate_events_total",
            1,
            {
                topic:
                    "criczone.live-events",

                event_type:
                    "BALL_RECORDED"
            }
        )


        expect(
            metrics.incrementCounter
        ).not.toHaveBeenCalledWith(
            "kafka_events_consumed_total",
            1,
            expect.anything()
        )


        expect(
            idempotencyStore.release
        ).not.toHaveBeenCalled()
    })


    it("should retain claim when failed event is successfully dead-lettered", async () => {

        const processingError =
            new Error(
                "processing failed"
            )


        retryStrategy.execute
            .mockRejectedValue(
                processingError
            )


        const event = {
            eventId:
                "event-failure-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "202",
                    key:
                        "match-1"
                })
            )
        ).resolves.toBeUndefined()


        expect(
            idempotencyStore.claim
        ).toHaveBeenCalledWith(
            "event-failure-1"
        )


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledTimes(1)


        expect(
            idempotencyStore.release
        ).not.toHaveBeenCalled()
    })


    it("should retain claim after successful processing", async () => {

        const handler =
            vi.fn()
                .mockResolvedValue(undefined)


        const event = {
            eventId:
                "event-success-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage(
                "criczone.live-events",
                handler
            )


        await eachMessage(
            createKafkaMessage({
                event,
                offset:
                    "203",
                key:
                    "match-1"
            })
        )


        expect(
            idempotencyStore.claim
        ).toHaveBeenCalledWith(
            "event-success-1"
        )


        expect(
            handler
        ).toHaveBeenCalledTimes(1)


        expect(
            idempotencyStore.release
        ).not.toHaveBeenCalled()


        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()


        expect(
            metrics.incrementCounter
        ).toHaveBeenCalledWith(
            "kafka_events_consumed_total",
            1,
            {
                topic:
                    "criczone.live-events",

                event_type:
                    "BALL_RECORDED"
            }
        )
    })


    it("should propagate idempotency claim failure without processing handler", async () => {

        const claimError =
            new Error(
                "idempotency store unavailable"
            )


        idempotencyStore.claim
            .mockRejectedValue(
                claimError
            )


        const handler =
            vi.fn()


        const event = {
            eventId:
                "event-claim-failure-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage(
                "criczone.live-events",
                handler
            )


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "204",
                    key:
                        "match-1"
                })
            )
        ).rejects.toBe(
            claimError
        )


        expect(
            handler
        ).not.toHaveBeenCalled()


        expect(
            retryStrategy.execute
        ).not.toHaveBeenCalled()


        expect(
            deadLetterPublisher.publish
        ).not.toHaveBeenCalled()


        expect(
            logger.error
        ).toHaveBeenCalled()
    })


    /*
     * STEP 20.8
     * DEAD-LETTER HANDLING
     */

    it("should publish event to DLQ when processing retries are exhausted", async () => {

        const processingError =
            new Error(
                "processing failed"
            )


        retryStrategy.execute
            .mockRejectedValue(
                processingError
            )


        const event = {
            eventId:
                "event-dlq-1",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-1"
        }


        const eachMessage =
            await getEachMessage()


        await eachMessage(
            createKafkaMessage({
                event,
                partition:
                    1,
                offset:
                    "300",
                key:
                    "match-1"
            })
        )


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledTimes(1)


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledWith(
            event,
            {
                topic:
                    "criczone.live-events",

                partition:
                    1,

                offset:
                    "300",

                key:
                    "match-1"
            },
            processingError
        )
    })


    it("should retain idempotency claim when DLQ publish succeeds", async () => {

        retryStrategy.execute
            .mockRejectedValue(
                new Error(
                    "processing failed"
                )
            )


        const event = {
            eventId:
                "event-dlq-2",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-2"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "301",
                    key:
                        "match-2"
                })
            )
        ).resolves.toBeUndefined()


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledTimes(1)


        expect(
            idempotencyStore.release
        ).not.toHaveBeenCalled()
    })


    it("should release idempotency claim and throw when DLQ publish fails", async () => {

        const processingError =
            new Error(
                "processing failed"
            )

        const dlqError =
            new Error(
                "DLQ unavailable"
            )


        retryStrategy.execute
            .mockRejectedValue(
                processingError
            )


        deadLetterPublisher.publish
            .mockRejectedValue(
                dlqError
            )


        const event = {
            eventId:
                "event-dlq-3",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-3"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "302",
                    key:
                        "match-3"
                })
            )
        ).rejects.toBe(
            dlqError
        )


        expect(
            deadLetterPublisher.publish
        ).toHaveBeenCalledWith(
            event,
            expect.objectContaining({
                offset:
                    "302"
            }),
            processingError
        )


        expect(
            idempotencyStore.release
        ).toHaveBeenCalledWith(
            "event-dlq-3"
        )


        expect(
            logger.error
        ).toHaveBeenCalledWith(
            "Kafka dead-letter publish failed",
            expect.objectContaining({
                eventId:
                    "event-dlq-3",

                errorMessage:
                    "DLQ unavailable"
            })
        )
    })


    it("should increment dead-letter metric only after successful DLQ publish", async () => {

        retryStrategy.execute
            .mockRejectedValue(
                new Error(
                    "processing failed"
                )
            )


        const event = {
            eventId:
                "event-dlq-4",

            type:
                "WICKET_RECORDED",

            aggregateId:
                "match-4"
        }


        const eachMessage =
            await getEachMessage()


        await eachMessage(
            createKafkaMessage({
                event,
                offset:
                    "303",
                key:
                    "match-4"
            })
        )


        expect(
            metrics.incrementCounter
        ).toHaveBeenCalledWith(
            "kafka_dead_letter_events_total",
            1,
            {
                topic:
                    "criczone.live-events",

                event_type:
                    "WICKET_RECORDED"
            }
        )
    })


    it("should not increment dead-letter metric when DLQ publish fails", async () => {

        retryStrategy.execute
            .mockRejectedValue(
                new Error(
                    "processing failed"
                )
            )


        deadLetterPublisher.publish
            .mockRejectedValue(
                new Error(
                    "DLQ unavailable"
                )
            )


        const event = {
            eventId:
                "event-dlq-5",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-5"
        }


        const eachMessage =
            await getEachMessage()


        await expect(
            eachMessage(
                createKafkaMessage({
                    event,
                    offset:
                        "304",
                    key:
                        "match-5"
                })
            )
        ).rejects.toThrow(
            "DLQ unavailable"
        )


        expect(
            metrics.incrementCounter
        ).not.toHaveBeenCalledWith(
            "kafka_dead_letter_events_total",
            1,
            expect.anything()
        )
    })


    it("should log successful dead-letter routing", async () => {

        const processingError =
            new Error(
                "database unavailable"
            )


        retryStrategy.execute
            .mockRejectedValue(
                processingError
            )


        const event = {
            eventId:
                "event-dlq-6",

            type:
                "BALL_RECORDED",

            aggregateId:
                "match-6"
        }


        const eachMessage =
            await getEachMessage()


        await eachMessage(
            createKafkaMessage({
                event,
                partition:
                    2,
                offset:
                    "305",
                key:
                    "match-6"
            })
        )


        expect(
            logger.error
        ).toHaveBeenCalledWith(
            "Kafka event moved to dead-letter topic",
            expect.objectContaining({
                eventId:
                    "event-dlq-6",

                eventType:
                    "BALL_RECORDED",

                topic:
                    "criczone.live-events",

                partition:
                    2,

                offset:
                    "305",

                errorMessage:
                    "database unavailable"
            })
        )
    })


    /*
     * DISCONNECT
     */

    it("should disconnect Kafka consumer", async () => {

        await consumer.disconnect()


        expect(
            kafkaConsumer.disconnect
        ).toHaveBeenCalledTimes(1)


        expect(
            logger.info
        ).toHaveBeenCalledWith(
            "Kafka consumer disconnected"
        )
    })


    it("should propagate disconnect failure", async () => {

        kafkaConsumer.disconnect
            .mockRejectedValue(
                new Error(
                    "disconnect failed"
                )
            )


        await expect(
            consumer.disconnect()
        ).rejects.toThrow(
            "disconnect failed"
        )


        expect(
            logger.error
        ).toHaveBeenCalled()
    })

    

})


// LLD principles:
//
// SRP — KafkaEventConsumer tests verify consumer orchestration,
// while DLQ publication remains behind its own abstraction.
//
// Dependency Injection — Kafka consumer, logger, metrics,
// retry strategy, idempotency store and dead-letter publisher
// are injected as mocks.
//
// DIP — KafkaEventConsumer depends on collaborator abstractions
// rather than constructing Kafka, Redis or DLQ infrastructure.
//
// Strategy Pattern — Retry behavior remains delegated to the
// injected retry strategy.
//
// Adapter Pattern — KafkaEventConsumer adapts KafkaJS message
// delivery into the application's EventConsumer behavior.
//
// Test Isolation — No external Kafka broker, Redis/Valkey,
// network connection or real retry delay is required.
//
// Fail Fast — Malformed events and infrastructure failures
// propagate instead of being silently ignored.
//
// Offset Safety — Successful processing, duplicate skipping
// and successful DLQ routing allow eachMessage to resolve.
//
// At-Least-Once Processing — Kafka redelivery remains possible
// when processing infrastructure cannot safely preserve an event.
//
// Idempotent Consumer Pattern — eventId is atomically claimed
// before business processing.
//
// Fail-Safe Recovery — If DLQ publication fails, the claim is
// released and the error propagates so redelivery can retry.
//
// Poison Message Handling — Permanently failing events are
// preserved in the DLQ rather than blocking normal consumption.
//
// Observability — success, failure, duplicate and dead-letter
// behavior is represented through metrics and structured logs.
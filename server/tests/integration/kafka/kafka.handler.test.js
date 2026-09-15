import { describe, it,vi, expect } from "vitest";
import { createTestKafka } from "../../helpers/testKafka.js";
import LiveBallEventHandler from "../../../src/messaging/handlers/LiveBallEventHandler.js";
import { createEvent } from "../../../src/messaging/EventFactory.js";

describe("Kafka Handler Invocation Integration", () => {
    it("should invoke LiveBallEventHandler for BALL_RECORDED", async () => {
        const kafka = createTestKafka()
        const producer = kafka.producer()
        const consumer = kafka.consumer({
            groupId: `criczone-test-handler-${Date.now()}`
        })
        const liveUpdateService = {
            processBallRecorded: vi.fn().mockResolvedValue(undefined)
        }
        const logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }

        const handler = new LiveBallEventHandler(liveUpdateService, logger)
        const event = createEvent({
            type: "BALL_RECORDED",
            aggregateId: "test-match-1005",
            payload: {
                matchId: 1005,
                inningsId: 2005,
                inningsNumber:1,
                overNumber: 10,
                ballNumber: 3,
                strikerId: 3005,
                nonStrikerId: 3006,
                bowlerId: 4001,
                runs: 4,
                extras: 0,
                boundary: true,
                wicket: {
                    occurred: false,
                },
                legalDelivery: true
            },
            requestId: "test-request-005",
            traceId: "test-trace-005"
        })
        let resolveHandler
        const handlerInvoked = new Promise(resolve => {
            resolveHandler = resolve
        })

        try {
            await producer.connect()
            await consumer.connect()
            await consumer.subscribe({
                topic: process.env.TEST_KAFKA_TOPIC,
                fromBeginning: false
            })
            const consumerReady = new Promise(resolve =>{
                consumer.on(consumer.events.GROUP_JOIN, () => resolve())
            })
            consumer.run({
                eachMessage: async ({
                    topic,
                    partition,
                    message
                }) => {
                    const receivedEvent = JSON.parse(message.value.toString())
                    if(receivedEvent.eventId != event.eventId)
                    {
                        return 
                    }
                    const metadata = {
                        topic,
                        partition,
                        offset: message.offset
                    }
                    await handler.handle(receivedEvent, metadata)
                    resolveHandler()
                }
            })
            await consumerReady
            await producer.send({
                topic: process.env.TEST_KAFKA_TOPIC,
                messages: [
                    {
                        key: event.aggregateId,
                        value: JSON.stringify(event)

                    }
                ]
            })

            await Promise.race([
                handlerInvoked,
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error("LiveBallEventHandler was not invoked"))
                    }, 10000)
                })
            ])

            expect(liveUpdateService.processBallRecorded).toHaveBeenCalledTimes(1)
            expect(liveUpdateService.processBallRecorded).toHaveBeenCalledWith(event)
            expect(logger.info).toHaveBeenCalledTimes(1)

        }
        finally {
            await consumer.disconnect()
            await producer.disconnect()
        }

    }, 30000)
})

// SRP — Handles/validates/routes live-ball events.
// Dependency Injection — liveUpdateService and logger are injected.
// DIP — Handler depends on supplied collaborators rather than constructing infrastructure.
// Delegation — handle() delegates BALL_RECORDED processing to handleBallRecorded(), which delegates business processing to LiveUpdateService.
// Service Layer — Business workflow remains in LiveUpdateService.
// Separation of Concerns — Event handling, logging, and business processing are separated.
// Testability — Injected dependencies can be mocked independently.

// Run:
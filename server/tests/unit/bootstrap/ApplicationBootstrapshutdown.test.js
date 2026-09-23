import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach
} from "vitest"

import ApplicationBootstrap
    from "../../../src/bootstrap/ApplicationBootstrap.js"


describe("ApplicationBootstrap graceful shutdown", () => {

    let databaseClient
    let redisClient
    let kafkaProducer
    let eventConsumer
    let kafkaAdmin
    let kafkaHealthChecker
    let app
    let bootstrap

    beforeEach(() => {

        app = {}

        databaseClient = {
            disconnect:
                vi.fn()
                    .mockResolvedValue(undefined)
        }

        redisClient = {
            isOpen: true,

            disconnect:
                vi.fn()
                    .mockResolvedValue(undefined)
        }

        kafkaProducer = {
            disconnect:
                vi.fn()
                    .mockResolvedValue(undefined)
        }

        eventConsumer = {
            disconnect:
                vi.fn()
                    .mockResolvedValue(undefined)
        }

        kafkaAdmin = {
            disconnect:
                vi.fn()
                    .mockResolvedValue(undefined)
        }

        kafkaHealthChecker = {}

        bootstrap =
            new ApplicationBootstrap(
                app,
                databaseClient,
                redisClient,
                kafkaProducer,
                eventConsumer,
                kafkaAdmin,
                kafkaHealthChecker,
                5000
            )

        bootstrap.io = {
            close:
                vi.fn()
                    .mockResolvedValue(undefined)
        }

        vi.spyOn(console, "log")
            .mockImplementation(() => {})

        vi.spyOn(console, "error")
            .mockImplementation(() => {})
    })


    afterEach(() => {
        vi.restoreAllMocks()
        vi.useRealTimers()
    })


    it("should close all infrastructure resources", async () => {

        await bootstrap.stop()

        expect(
            bootstrap.io.close
        ).toHaveBeenCalledTimes(1)

        expect(
            eventConsumer.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            kafkaProducer.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            kafkaAdmin.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            redisClient.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            databaseClient.disconnect
        ).toHaveBeenCalledTimes(1)
    })


    it("should disconnect infrastructure in correct order", async () => {

        await bootstrap.stop()

        const websocketOrder =
            bootstrap.io.close
                .mock.invocationCallOrder[0]

        const consumerOrder =
            eventConsumer.disconnect
                .mock.invocationCallOrder[0]

        const producerOrder =
            kafkaProducer.disconnect
                .mock.invocationCallOrder[0]

        const adminOrder =
            kafkaAdmin.disconnect
                .mock.invocationCallOrder[0]

        const redisOrder =
            redisClient.disconnect
                .mock.invocationCallOrder[0]

        const databaseOrder =
            databaseClient.disconnect
                .mock.invocationCallOrder[0]


        expect(websocketOrder)
            .toBeLessThan(consumerOrder)

        expect(consumerOrder)
            .toBeLessThan(producerOrder)

        expect(producerOrder)
            .toBeLessThan(adminOrder)

        expect(adminOrder)
            .toBeLessThan(redisOrder)

        expect(redisOrder)
            .toBeLessThan(databaseOrder)
    })


    it("should continue cleanup when Kafka consumer disconnect fails", async () => {

        eventConsumer.disconnect
            .mockRejectedValue(
                new Error(
                    "Kafka consumer disconnect failed"
                )
            )

        await expect(
            bootstrap.stop()
        ).rejects.toBeInstanceOf(
            AggregateError
        )

        expect(
            kafkaProducer.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            kafkaAdmin.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            redisClient.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            databaseClient.disconnect
        ).toHaveBeenCalledTimes(1)
    })


    it("should aggregate multiple shutdown failures", async () => {

        eventConsumer.disconnect
            .mockRejectedValue(
                new Error(
                    "consumer failure"
                )
            )

        kafkaProducer.disconnect
            .mockRejectedValue(
                new Error(
                    "producer failure"
                )
            )

        kafkaAdmin.disconnect
            .mockRejectedValue(
                new Error(
                    "admin failure"
                )
            )

        let thrownError

        try {
            await bootstrap.stop()
        }
        catch (error) {
            thrownError = error
        }

        expect(
            thrownError
        ).toBeInstanceOf(
            AggregateError
        )

        expect(
            thrownError.errors
        ).toHaveLength(3)

        expect(
            redisClient.disconnect
        ).toHaveBeenCalledTimes(1)

        expect(
            databaseClient.disconnect
        ).toHaveBeenCalledTimes(1)
    })


    it("should skip Redis disconnect when Redis is not open", async () => {

        redisClient.isOpen = false

        await bootstrap.stop()

        expect(
            redisClient.disconnect
        ).not.toHaveBeenCalled()

        expect(
            databaseClient.disconnect
        ).toHaveBeenCalledTimes(1)
    })


    it("should timeout Kafka consumer disconnect without blocking remaining cleanup", async () => {

    vi.useFakeTimers()

    eventConsumer.disconnect
        .mockReturnValue(
            new Promise(() => {})
        )

    const shutdownExpectation =
        expect(
            bootstrap.stop()
        ).rejects.toBeInstanceOf(
            AggregateError
        )

    await vi.advanceTimersByTimeAsync(
        10000
    )

    await shutdownExpectation

    expect(
        kafkaProducer.disconnect
    ).toHaveBeenCalledTimes(1)

    expect(
        kafkaAdmin.disconnect
    ).toHaveBeenCalledTimes(1)

    expect(
        redisClient.disconnect
    ).toHaveBeenCalledTimes(1)

    expect(
        databaseClient.disconnect
    ).toHaveBeenCalledTimes(1)
})
})

// SRP — ApplicationBootstrap owns application lifecycle orchestration.
// DI — all infrastructure dependencies are injected/mocked.
// DIP — lifecycle code works against dependency behavior rather than constructing infrastructure.
// Failure Isolation — one cleanup failure doesn't block subsequent cleanup.
// Resource Safety — all infrastructure receives a shutdown attempt.
// Dependency Ordering — Kafka processing closes before Redis/PostgreSQL.
// Error Aggregation — multiple cleanup failures are reported together.
// Test Isolation — no real Kafka, Redis, PostgreSQL, HTTP server, or WebSocket connection is required.
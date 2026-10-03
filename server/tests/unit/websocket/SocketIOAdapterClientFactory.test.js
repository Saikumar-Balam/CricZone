import { beforeEach, describe, expect, it, vi } from "vitest"

const {
    createClientMock,
    pubClient,
    subClient
} = vi.hoisted(() => {

    const pubClient = {
        on: vi.fn(),
        connect: vi.fn(),
        duplicate: vi.fn(),
        quit: vi.fn(),
        disconnect: vi.fn(),
        isOpen: false
    }

    const subClient = {
        on: vi.fn(),
        connect: vi.fn(),
        quit: vi.fn(),
        disconnect: vi.fn(),
        isOpen: false
    }

    return {
        createClientMock: vi.fn(),
        pubClient,
        subClient
    }
})

vi.mock("redis", () => ({
    createClient: createClientMock
}))

import SocketIOAdapterClientFactory
    from "../../../src/websocket/SocketIOAdapterClientFactory.js"

describe("SocketIOAdapterClientFactory", () => {

    let logger
    let metrics

    beforeEach(() => {

        vi.clearAllMocks()

        pubClient.isOpen = false
        subClient.isOpen = false

        pubClient.duplicate.mockReturnValue(
            subClient
        )

        createClientMock.mockReturnValue(
            pubClient
        )

        logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }

        metrics = {
            incrementCounter: vi.fn()
        }
    })

    it(
        "should log and propagate adapter connection failure",
        async () => {

            const connectionError =
                new Error("Valkey unavailable")

            pubClient.connect.mockRejectedValue(
                connectionError
            )

            subClient.connect.mockResolvedValue(
                undefined
            )

            const factory =
                new SocketIOAdapterClientFactory(
                    "rediss://test-valkey",
                    logger,
                    metrics
                )

            await expect(
                factory.create()
            ).rejects.toThrow(
                "Valkey unavailable"
            )

            expect(
                logger.error
            ).toHaveBeenCalledWith(
                "Socket.IO Redis adapter connection failed",
                {
                    errorMessage:
                        "Valkey unavailable"
                }
            )
        }
    )

    it(
        "should clean up connected clients when partial startup fails",
        async () => {

            const connectionError =
                new Error("Subscriber connection failed")

            pubClient.connect.mockImplementation(
                async () => {
                    pubClient.isOpen = true
                }
            )

            subClient.connect.mockRejectedValue(
                connectionError
            )

            pubClient.quit.mockImplementation(
                async () => {
                    pubClient.isOpen = false
                }
            )

            const factory =
                new SocketIOAdapterClientFactory(
                    "rediss://test-valkey",
                    logger,
                    metrics
                )

            await expect(
                factory.create()
            ).rejects.toThrow(
                "Subscriber connection failed"
            )

            expect(
                pubClient.quit
            ).toHaveBeenCalledTimes(1)

            expect(
                pubClient.isOpen
            ).toBe(false)

            expect(
                subClient.quit
            ).not.toHaveBeenCalled()

            expect(
                logger.error
            ).toHaveBeenCalledWith(
                "Socket.IO Redis adapter connection failed",
                {
                    errorMessage:
                        "Subscriber connection failed"
                }
            )
        }
    )

    it(
        "should register and handle runtime lifecycle events",
        async () => {

            const pubHandlers = {}

            pubClient.on.mockImplementation(
                (event, handler) => {
                    pubHandlers[event] = handler
                }
            )

            pubClient.connect.mockImplementation(
                async () => {
                    pubClient.isOpen = true
                }
            )

            subClient.connect.mockImplementation(
                async () => {
                    subClient.isOpen = true
                }
            )

            const factory =
                new SocketIOAdapterClientFactory(
                    "rediss://test-valkey",
                    logger,
                    metrics
                )

            await factory.create()

            expect(pubClient.on).toHaveBeenCalledWith(
                "error",
                expect.any(Function)
            )

            expect(pubClient.on).toHaveBeenCalledWith(
                "reconnecting",
                expect.any(Function)
            )

            expect(pubClient.on).toHaveBeenCalledWith(
                "ready",
                expect.any(Function)
            )

            expect(pubClient.on).toHaveBeenCalledWith(
                "end",
                expect.any(Function)
            )

            pubHandlers.error(
                new Error("Runtime Valkey failure")
            )

            pubHandlers.reconnecting()
            pubHandlers.ready()
            pubHandlers.end()

            expect(
                metrics.incrementCounter
            ).toHaveBeenCalledWith(
                "websocket_adapter_errors_total",
                1,
                {
                    role: "publisher"
                }
            )

            expect(
                metrics.incrementCounter
            ).toHaveBeenCalledWith(
                "websocket_adapter_reconnects_total",
                1,
                {
                    role: "publisher"
                }
            )

            expect(logger.error).toHaveBeenCalledWith(
                "Socket.IO Redis adapter client error",
                {
                    role: "publisher",
                    errorMessage:
                        "Runtime Valkey failure"
                }
            )

            expect(logger.warn).toHaveBeenCalledWith(
                "Socket.IO Redis adapter client reconnecting",
                {
                    role: "publisher"
                }
            )

            expect(logger.info).toHaveBeenCalledWith(
                "Socket.IO Redis adapter client ready",
                {
                    role: "publisher"
                }
            )

            expect(logger.warn).toHaveBeenCalledWith(
                "Socket.IO Redis adapter client connection ended",
                {
                    role: "publisher"
                }
            )
        }
    )
})

// Test Isolation — no real Aiven/Valkey connection is used.
// Dependency Isolation — external Redis client behavior is mocked.
// Fail Fast — verifies connection errors propagate.
// Observability — verifies infrastructure failure is logged.
// SRP — this test checks only adapter connection-failure behavior.

// Resource Safety — successfully opened resources are closed when initialization fails.
// Resource Ownership — the factory owns its clients until create() successfully returns.
// Failure Isolation — one connection failure doesn't prevent cleanup of another client.
// Fail Fast — the original startup error continues propagating.
// SRP — the factory owns creation and failed-creation cleanup.
// Test Isolation — failure behavior is verified without touching real Aiven infrastructure.

// Consistency — structured logs use the same errorMessage field.
// Observability — reliable field names matter for log querying and dashboards.
// Test Isolation — the unit test caught the defect without real Valkey failure.
// Fail Fast — tests expose contract mistakes immediately.
// SRP — the factory remains responsible for adapter-client lifecycle logging.
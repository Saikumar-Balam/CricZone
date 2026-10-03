import { describe, it, expect, vi, beforeEach } from "vitest"

import SocketConnectionHandler from "../../../src/websocket/SocketConnectionHandler.js"

describe("SocketConnectionHandler", () => {

    let logger
    let metrics
    let handler
    let socket
    let eventHandlers

    beforeEach(() => {

        eventHandlers = {}

        logger = {
            info: vi.fn(),
            warn: vi.fn()
        }

        metrics = {
            setGauge: vi.fn(),
            incrementCounter: vi.fn()
        }

        socket = {
            id: "socket-123",

            server: {
                engine: {
                    clientsCount: 5
                }
            },

            on: vi.fn((event, callback) => {
                eventHandlers[event] = callback
            }),

            join: vi.fn(),
            leave: vi.fn()
        }

        handler = new SocketConnectionHandler(logger, metrics)
    })

    it("should handle new WebSocket connection", () => {

        handler.handle(socket)

        expect(metrics.setGauge).toHaveBeenCalledWith(
            "websocket_connected_clients",
            5
        )

        expect(metrics.incrementCounter).toHaveBeenCalledWith(
            "websocket_connections_total",
            1
        )

        expect(logger.info).toHaveBeenCalledWith(
            "Websocket client connected",
            {
                socketId: "socket-123"
            }
        )

        expect(socket.on).toHaveBeenCalledWith(
            "join-match",
            expect.any(Function)
        )

        expect(socket.on).toHaveBeenCalledWith(
            "leave-match",
            expect.any(Function)
        )

        expect(socket.on).toHaveBeenCalledWith(
            "disconnect",
            expect.any(Function)
        )
    })

    it("should join match room", () => {

        handler.handle(socket)

        eventHandlers["join-match"]("456")

        expect(socket.join).toHaveBeenCalledWith(
            "match:456"
        )

        expect(metrics.incrementCounter).toHaveBeenCalledWith(
            "websocket_room_joins_total",
            1
        )

        expect(logger.info).toHaveBeenCalledWith(
            "Websocket client joined match room",
            {
                socketId: "socket-123",
                matchId: "456",
                room: "match:456"
            }
        )
    })

    it("should leave match room", () => {

        handler.handle(socket)

        eventHandlers["leave-match"]("456")

        expect(socket.leave).toHaveBeenCalledWith(
            "match:456"
        )

        expect(metrics.incrementCounter).toHaveBeenCalledWith(
            "websocket_room_leaves_total",
            1
        )

        expect(logger.info).toHaveBeenCalledWith(
            "Websocket client left match room",
            {
                socketId: "socket-123",
                matchId: "456",
                room: "match:456"
            }
        )
    })

    it("should handle WebSocket disconnect", () => {

        handler.handle(socket)

        socket.server.engine.clientsCount = 4

        eventHandlers.disconnect("transport close")

        expect(metrics.setGauge).toHaveBeenCalledWith(
            "websocket_connected_clients",
            4
        )

        expect(metrics.incrementCounter).toHaveBeenCalledWith(
            "websocket_disconnections_total",
            1,
            {
                reason: "transport close"
            }
        )

        expect(logger.info).toHaveBeenCalledWith(
            "Websocket client disconnected",
            {
                socketId: "socket-123",
                reason: "transport close"
            }
        )
    })

    it("should reject invalid match room subscription", () => {

        handler.handle(socket)

        const invalidMatchIds = [
            undefined,
            null,
            "",
            "   ",
            {},
            []
        ]

        for (const matchId of invalidMatchIds)
        {
            eventHandlers["join-match"](matchId)
        }

        expect(socket.join).not.toHaveBeenCalled()

        expect(logger.warn).toHaveBeenCalledTimes(
            invalidMatchIds.length
        )

        expect(metrics.incrementCounter).toHaveBeenCalledTimes(
            invalidMatchIds.length + 1
        )

        expect(metrics.incrementCounter).toHaveBeenCalledWith(
            "websocket_invalid_subscriptions_total",
            1,
            {
                action: "join"
            }
        )
    })

    it("should reject invalid match room unsubscription", () => {

        handler.handle(socket)

        const invalidMatchIds = [
            undefined,
            null,
            "",
            "   ",
            {},
            []
        ]

        for (const matchId of invalidMatchIds)
        {
            eventHandlers["leave-match"](matchId)
        }

        expect(socket.leave).not.toHaveBeenCalled()

        expect(logger.warn).toHaveBeenCalledTimes(
            invalidMatchIds.length
        )

        expect(metrics.incrementCounter).toHaveBeenCalledTimes(
            invalidMatchIds.length + 1
        )

        expect(metrics.incrementCounter).toHaveBeenCalledWith(
            "websocket_invalid_subscriptions_total",
            1,
            {
                action: "leave"
            }
        )
    })
})

// SRP
// Handles socket lifecycle and room membership only.
//
// DI
// Logger and Metrics are constructor injected.
//
// Separation of Concerns
// Connection lifecycle is separated from event broadcasting.
//
// Encapsulation
// Room naming and socket lifecycle behavior remain
// inside the WebSocket layer.
//
// Testability
// Socket, logger and metrics can be mocked.
//
// Observability
// Connection count and lifecycle events are recorded.
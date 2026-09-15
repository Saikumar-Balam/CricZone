import { describe, it, expect, vi } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

import SocketConnectionHandler from
    "../../../src/websocket/SocketConnectionHandler.js"

import SocketIOGateway from
    "../../../src/websocket/SocketIOGateway.js"

describe("WebSocket BALL_RECORDED Delivery Integration", () => {

    it("should deliver BALL_RECORDED event to client in match room", async () => {

        const httpServer = createServer()

        const io = new Server(httpServer, {
            cors: {
                origin: "*"
            }
        })

        const logger = {
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        }

        const metrics = {
            setGauge: vi.fn(),
            incrementCounter: vi.fn()
        }

        const connectionHandler =
            new SocketConnectionHandler(
                logger,
                metrics
            )

        const gateway =
            new SocketIOGateway(
                io,
                logger,
                metrics
            )

        io.on(
            "connection",
            connectionHandler.handle
        )

        let client

        try {

            await new Promise(resolve => {
                httpServer.listen(0, resolve)
            })

            const port =
                httpServer.address().port

            client = createClient(
                `http://localhost:${port}`,
                {
                    transports: ["websocket"],
                    forceNew: true,
                    reconnection: false
                }
            )

            await new Promise((resolve, reject) => {

                const timeout =
                    setTimeout(() => {
                        reject(
                            new Error(
                                "Socket.IO client connection timed out"
                            )
                        )
                    }, 5000)

                client.once("connect", () => {
                    clearTimeout(timeout)
                    resolve()
                })

                client.once(
                    "connect_error",
                    error => {
                        clearTimeout(timeout)
                        reject(error)
                    }
                )
            })

            const matchId = 1001
            const room = `match:${matchId}`

            client.emit(
                "join-match",
                matchId
            )

            await new Promise(resolve =>
                setTimeout(resolve, 100)
            )

            // Verify room membership first
            const sockets =
                await io.in(room).fetchSockets()

            expect(sockets)
                .toHaveLength(1)

            expect(sockets[0].id)
                .toBe(client.id)

            const ballRecordedPayload = {
                eventId:
                    "550e8400-e29b-41d4-a716-446655440000",

                type: "BALL_RECORDED",

                aggregateId: matchId,

                timestamp:
                    new Date().toISOString(),

                requestId:
                    "websocket-test-request",

                traceId:
                    "websocket-test-trace",

                payload: {
                    inningsId: 2001,
                    inningsNumber: 1,

                    overNumber: 10,
                    ballNumber: 3,

                    strikerId: 3001,
                    nonStrikerId: 3002,
                    bowlerId: 4001,

                    runs: 4,
                    extras: 0,

                    boundary: true,

                    wicket: {
                        occurred: false,
                        type: null,
                        dismissedPlayerId: null
                    },

                    legalDelivery: true
                }
            }

            const eventReceived =
                new Promise((resolve, reject) => {

                    const timeout =
                        setTimeout(() => {

                            reject(
                                new Error(
                                    "BALL_RECORDED event was not received"
                                )
                            )

                        }, 5000)

                    client.once(
                        "BALL_RECORDED",
                        receivedPayload => {

                            clearTimeout(timeout)

                            resolve(receivedPayload)
                        }
                    )
                })

            gateway.emitToRoom(
                room,
                "BALL_RECORDED",
                ballRecordedPayload
            )

            const receivedPayload =
                await eventReceived

            expect(receivedPayload)
                .toEqual(ballRecordedPayload)

            expect(receivedPayload.type)
                .toBe("BALL_RECORDED")

            expect(receivedPayload.aggregateId)
                .toBe(matchId)

            expect(receivedPayload.payload)
                .toEqual(
                    ballRecordedPayload.payload
                )

            expect(
                metrics.incrementCounter
            ).toHaveBeenCalledWith(
                "websocket_emit_total",
                1,
                {
                    scope: "room",
                    event_type: "BALL_RECORDED"
                }
            )

            expect(
                logger.debug
            ).toHaveBeenCalledWith(
                "Websocket event emitted to room",
                {
                    room,
                    event: "BALL_RECORDED"
                }
            )

        } finally {

            if (client) {
                client.disconnect()
            }

            await new Promise(resolve => {
                io.close(() => resolve())
            })
        }

    }, 10000)
})

// SRP — Tests only BALL_RECORDED WebSocket delivery.
// DI — Socket.IO, logger and metrics are injected.
// DIP — Gateway uses supplied dependencies rather than constructing infrastructure.
// Abstraction — SocketIOGateway implements the WebSocketGateway contract.
// LSP — Concrete Socket.IO gateway can fulfill the gateway contract.
// Observer Pattern — Client subscribes to BALL_RECORDED.
// Separation of Concerns — Kafka processing and WebSocket delivery are tested independently.
// Encapsulation — Socket.IO-specific delivery remains inside SocketIOGateway.
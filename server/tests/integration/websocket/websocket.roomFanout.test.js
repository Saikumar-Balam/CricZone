import { describe, it, expect, vi } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

import SocketIOGateway from "../../../src/websocket/SocketIOGateway.js"

import WebSocketRooms from "../../../src/websocket/WebSocketRooms.js"

describe("WebSocket Room Broadcast Fan-out", () => {

    it(
        "should deliver one room event to all subscribed clients",
        async () => {

            const httpServer = createServer()
            const io = new Server(httpServer)

            const clients = []

            const logger = {
                debug: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            }

            const metrics = {
                incrementCounter: vi.fn()
            }

            try
            {
                await new Promise(resolve =>
                    httpServer.listen(0, resolve)
                )

                const port =
                    httpServer.address().port

                const clientCount = 50

                for (let i = 0; i < clientCount; i++)
                {
                    clients.push(
                        createClient(
                            `http://localhost:${port}`,
                            {
                                transports: ["websocket"],
                                forceNew: true,
                                reconnection: false
                            }
                        )
                    )
                }

                await Promise.all(
                    clients.map(client =>
                        waitForConnection(client)
                    )
                )

                const room =
                    WebSocketRooms.match("1001")

                const serverSockets =
                    clients.map(client =>
                        io.sockets.sockets.get(
                            client.id
                        )
                    )

                expect(
                    serverSockets.every(Boolean)
                ).toBe(true)

                await Promise.all(
                    serverSockets.map(socket =>
                        socket.join(room)
                    )
                )

                const roomMembers =
                    io.sockets.adapter.rooms.get(
                        room
                    )

                expect(
                    roomMembers?.size
                ).toBe(clientCount)

                const receivedEvents =
                    clients.map(client =>
                        waitForEvent(
                            client,
                            "BALL_RECORDED"
                        )
                    )

                const gateway =
                    new SocketIOGateway(
                        io,
                        logger,
                        metrics
                    )

                const payload = {
                    matchId: "1001",
                    runs: 6
                }

                gateway.emitToRoom(
                    room,
                    "BALL_RECORDED",
                    payload
                )

                const receivedPayloads =
                    await Promise.all(
                        receivedEvents
                    )

                expect(
                    receivedPayloads
                ).toHaveLength(clientCount)

                for (const receivedPayload
                    of receivedPayloads)
                {
                    expect(
                        receivedPayload
                    ).toEqual(payload)
                }

                expect(
                    metrics.incrementCounter
                ).toHaveBeenCalledWith(
                    "websocket_emit_total",
                    1,
                    {
                        scope: "room",
                        event_type:
                            "BALL_RECORDED"
                    }
                )
            }
            finally
            {
                for (const client of clients)
                {
                    client.disconnect()
                }

                await closeIO(io)
            }
        },
        15000
    )
})

function waitForConnection(client)
{
    if (client.connected)
    {
        return Promise.resolve()
    }

    return new Promise((resolve, reject) => {

        client.once(
            "connect",
            resolve
        )

        client.once(
            "connect_error",
            reject
        )
    })
}

function waitForEvent(client, event)
{
    return new Promise((resolve, reject) => {

        const timeout =
            setTimeout(() => {

                reject(
                    new Error(
                        `Timed out waiting for ${event}`
                    )
                )
            }, 5000)

        client.once(
            event,
            payload => {

                clearTimeout(timeout)

                resolve(payload)
            }
        )
    })
}

function closeIO(io)
{
    return new Promise(resolve => {

        io.close(() => resolve())
    })
}

// DIP — emission goes through SocketIOGateway.
// DI — logger and metrics are injected into the gateway.
// SRP — this test verifies fan-out behavior only.
// Room Abstraction — WebSocketRooms owns room naming.
// Resource Safety — all socket clients and server resources are cleaned up.
// Test Isolation — fan-out is tested independently of Kafka, PostgreSQL, and Valkey.
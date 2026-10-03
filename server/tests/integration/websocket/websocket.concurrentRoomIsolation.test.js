import { describe, it, expect, vi } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

import SocketIOGateway
    from "../../../src/websocket/SocketIOGateway.js"

import WebSocketRooms
    from "../../../src/websocket/WebSocketRooms.js"

describe("WebSocket Concurrent Room Isolation", () => {

    it(
        "should deliver events only to clients in the target room",
        async () => {

            const httpServer = createServer()
            const io = new Server(httpServer)

            const targetClients = []
            const otherClients = []

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

                const clientsPerRoom = 25

                for (let i = 0; i < clientsPerRoom; i++)
                {
                    targetClients.push(
                        createClient(
                            `http://localhost:${port}`,
                            {
                                transports: ["websocket"],
                                forceNew: true,
                                reconnection: false
                            }
                        )
                    )

                    otherClients.push(
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

                const allClients = [
                    ...targetClients,
                    ...otherClients
                ]

                await Promise.all(
                    allClients.map(client =>
                        waitForConnection(client)
                    )
                )

                const room1001 =
                    WebSocketRooms.match("1001")

                const room2002 =
                    WebSocketRooms.match("2002")

                const targetServerSockets =
                    targetClients.map(client =>
                        io.sockets.sockets.get(
                            client.id
                        )
                    )

                const otherServerSockets =
                    otherClients.map(client =>
                        io.sockets.sockets.get(
                            client.id
                        )
                    )

                expect(
                    targetServerSockets.every(Boolean)
                ).toBe(true)

                expect(
                    otherServerSockets.every(Boolean)
                ).toBe(true)

                await Promise.all([
                    ...targetServerSockets.map(
                        socket =>
                            socket.join(room1001)
                    ),
                    ...otherServerSockets.map(
                        socket =>
                            socket.join(room2002)
                    )
                ])

                expect(
                    io.sockets.adapter.rooms.get(
                        room1001
                    )?.size
                ).toBe(clientsPerRoom)

                expect(
                    io.sockets.adapter.rooms.get(
                        room2002
                    )?.size
                ).toBe(clientsPerRoom)

                const targetEvents =
                    targetClients.map(client =>
                        waitForEvent(
                            client,
                            "BALL_RECORDED"
                        )
                    )

                let wrongRoomDeliveries = 0

                for (const client of otherClients)
                {
                    client.on(
                        "BALL_RECORDED",
                        () => {
                            wrongRoomDeliveries++
                        }
                    )
                }

                const gateway =
                    new SocketIOGateway(
                        io,
                        logger,
                        metrics
                    )

                const payload = {
                    matchId: "1001",
                    runs: 4
                }

                gateway.emitToRoom(
                    room1001,
                    "BALL_RECORDED",
                    payload
                )

                const receivedPayloads =
                    await Promise.all(
                        targetEvents
                    )

                expect(
                    receivedPayloads
                ).toHaveLength(
                    clientsPerRoom
                )

                for (const receivedPayload
                    of receivedPayloads)
                {
                    expect(
                        receivedPayload
                    ).toEqual(payload)
                }

                await delay(300)

                expect(
                    wrongRoomDeliveries
                ).toBe(0)

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
                const allClients = [
                    ...targetClients,
                    ...otherClients
                ]

                for (const client of allClients)
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

function delay(ms)
{
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    )
}

// DIP — application emission is exercised through SocketIOGateway.
// DI — logger and metrics are injected.
// SRP — this test focuses on concurrent room isolation.
// Room Abstraction — room naming remains centralized in WebSocketRooms.
// Resource Safety — every client and server is cleaned up.
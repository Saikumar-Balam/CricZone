import { describe, it, expect } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

import WebSocketRooms from "../../../src/websocket/WebSocketRooms.js"

describe("WebSocket Large Room Subscription", () => {

    it(
        "should allow multiple concurrent clients to join the same match room",
        async () => {

            const httpServer = createServer()
            const io = new Server(httpServer)

            const clients = []

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
                    roomMembers
                ).toBeDefined()

                expect(
                    roomMembers.size
                ).toBe(clientCount)

                for (const socket of serverSockets)
                {
                    expect(
                        socket.rooms.has(room)
                    ).toBe(true)
                }
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

function closeIO(io)
{
    return new Promise(resolve => {

        io.close(() => resolve())
    })
}

// SRP — tests room subscription scalability only.
// Room Abstraction — WebSocketRooms owns room-name construction.
// Resource Safety — all clients and server resources are cleaned up.
// Test Isolation — no Kafka, PostgreSQL, or production server is required.
// Separation of Concerns — room membership is tested separately from broadcast fan-out and heavy load testing.
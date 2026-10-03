import { describe, it, expect } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

describe("WebSocket Concurrent Connections", () => {

    it(
        "should support multiple concurrent client connections",
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
                    clients.map(
                        client =>
                            waitForConnection(client)
                    )
                )

                expect(
                    io.engine.clientsCount
                ).toBe(clientCount)

                expect(
                    io.sockets.sockets.size
                ).toBe(clientCount)

                for (const client of clients)
                {
                    expect(
                        client.connected
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

// SRP — this test verifies concurrent connection behavior only.
// Test Isolation — an independent HTTP/Socket.IO server is created for the test.
// Resource Safety — all clients and the server are closed in finally.
// Separation of Concerns — architectural scalability testing remains separate from  performance/load testing.
// Deterministic Testing — assertions use actual connected-client state rather than arbitrary timing assumptions.
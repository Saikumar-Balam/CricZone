import { describe, it, expect } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

describe("WebSocket Connection Churn", () => {

    it(
        "should cleanly handle repeated concurrent connection and disconnection cycles",
        async () => {

            const httpServer = createServer()
            const io = new Server(httpServer)

            const activeClients = []

            try
            {
                await new Promise(resolve =>
                    httpServer.listen(0, resolve)
                )

                const port =
                    httpServer.address().port

                const cycles = 5
                const clientsPerCycle = 20

                for (let cycle = 0; cycle < cycles; cycle++)
                {
                    const cycleClients = []

                    for (
                        let i = 0;
                        i < clientsPerCycle;
                        i++
                    )
                    {
                        const client =
                            createClient(
                                `http://localhost:${port}`,
                                {
                                    transports: ["websocket"],
                                    forceNew: true,
                                    reconnection: false
                                }
                            )

                        cycleClients.push(client)
                        activeClients.push(client)
                    }

                    await Promise.all(
                        cycleClients.map(client =>
                            waitForConnection(client)
                        )
                    )

                    expect(
                        io.engine.clientsCount
                    ).toBe(clientsPerCycle)

                    expect(
                        io.sockets.sockets.size
                    ).toBe(clientsPerCycle)

                    const disconnects =
                        cycleClients.map(client =>
                            waitForServerDisconnect(
                                io,
                                client.id
                            )
                        )

                    for (const client
                        of cycleClients)
                    {
                        client.disconnect()
                    }

                    await Promise.all(disconnects)

                    await waitForClientCount(
                        io,
                        0
                    )

                    expect(
                        io.engine.clientsCount
                    ).toBe(0)

                    expect(
                        io.sockets.sockets.size
                    ).toBe(0)

                    for (const client
                        of cycleClients)
                    {
                        const index =
                            activeClients.indexOf(
                                client
                            )

                        if (index !== -1)
                        {
                            activeClients.splice(
                                index,
                                1
                            )
                        }
                    }
                }

                expect(
                    io.engine.clientsCount
                ).toBe(0)

                expect(
                    io.sockets.sockets.size
                ).toBe(0)
            }
            finally
            {
                for (const client
                    of activeClients)
                {
                    client.disconnect()
                }

                await closeIO(io)
            }
        },
        20000
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

function waitForServerDisconnect(io, socketId)
{
    const socket =
        io.sockets.sockets.get(socketId)

    if (!socket)
    {
        return Promise.resolve()
    }

    return new Promise(resolve => {

        socket.once(
            "disconnect",
            resolve
        )
    })
}

async function waitForClientCount(
    io,
    expectedCount
)
{
    const timeoutMs = 3000
    const intervalMs = 20

    const startedAt = Date.now()

    while (
        io.engine.clientsCount !== expectedCount ||
        io.sockets.sockets.size !== expectedCount
    )
    {
        if (
            Date.now() - startedAt >= timeoutMs
        )
        {
            throw new Error(
                `Timed out waiting for ${expectedCount} WebSocket clients`
            )
        }

        await delay(intervalMs)
    }
}

function delay(ms)
{
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    )
}

function closeIO(io)
{
    return new Promise(resolve => {

        io.close(() => resolve())
    })
}

// SRP — this test focuses only on connection lifecycle churn.
// Resource Safety — disconnected clients must be removed and all remaining resources are cleaned in finally.
// Deterministic Testing — state polling verifies cleanup rather than relying on a fixed sleep.
// Separation of Concerns — lifecycle scalability is tested independently from room fan-out and distributed broadcasting.
// Test Isolation — no Kafka, PostgreSQL, or Valkey dependency is required.
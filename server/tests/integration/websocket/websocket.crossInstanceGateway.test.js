import { describe, it, expect, vi } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

import SocketIOGateway
    from "../../../src/websocket/SocketIOGateway.js"

import SocketIOAdapterClientFactory
    from "../../../src/websocket/SocketIOAdapterClientFactory.js"

import SocketIORedisAdapter
    from "../../../src/websocket/SocketIORedisAdapter.js"

import WebSocketRooms
    from "../../../src/websocket/WebSocketRooms.js"

describe("Cross-instance SocketIOGateway Integration", () => {

    it(
        "should deliver event across instances only to clients in the target room",
        async () => {

            const redisUrl = process.env.TEST_REDIS_URL

            expect(redisUrl).toBeTruthy()

            const logger = {
                info: vi.fn(),
                debug: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            }

            const metrics = {
                incrementCounter: vi.fn()
            }

            const httpServerA = createServer()
            const httpServerB = createServer()

            const ioA = new Server(httpServerA)
            const ioB = new Server(httpServerB)

            let pubClientA
            let subClientA
            let pubClientB
            let subClientB

            let match1001Client
            let match2002Client

            try
            {
                const factoryA =
                    new SocketIOAdapterClientFactory(
                        redisUrl,
                        logger,
                        metrics
                    )

                const factoryB =
                    new SocketIOAdapterClientFactory(
                        redisUrl,
                        logger,
                        metrics
                    )

                ;({
                    pubClient: pubClientA,
                    subClient: subClientA
                } = await factoryA.create())

                ;({
                    pubClient: pubClientB,
                    subClient: subClientB
                } = await factoryB.create())

                const adapterA =
                    new SocketIORedisAdapter(logger)

                const adapterB =
                    new SocketIORedisAdapter(logger)

                adapterA.attach(
                    ioA,
                    pubClientA,
                    subClientA
                )

                adapterB.attach(
                    ioB,
                    pubClientB,
                    subClientB
                )

                await Promise.all([
                    new Promise(resolve =>
                        httpServerA.listen(0, resolve)
                    ),
                    new Promise(resolve =>
                        httpServerB.listen(0, resolve)
                    )
                ])

                const portB =
                    httpServerB.address().port

                match1001Client = createClient(
                    `http://localhost:${portB}`,
                    {
                        transports: ["websocket"],
                        forceNew: true,
                        reconnection: false
                    }
                )

                match2002Client = createClient(
                    `http://localhost:${portB}`,
                    {
                        transports: ["websocket"],
                        forceNew: true,
                        reconnection: false
                    }
                )

                await Promise.all([
                    waitForConnection(match1001Client),
                    waitForConnection(match2002Client)
                ])

                const room1001 =
                    WebSocketRooms.match("1001")

                const room2002 =
                    WebSocketRooms.match("2002")

                const serverSocket1001 =
                    ioB.sockets.sockets.get(
                        match1001Client.id
                    )

                const serverSocket2002 =
                    ioB.sockets.sockets.get(
                        match2002Client.id
                    )

                expect(
                    serverSocket1001
                ).toBeDefined()

                expect(
                    serverSocket2002
                ).toBeDefined()

                await serverSocket1001.join(
                    room1001
                )

                await serverSocket2002.join(
                    room2002
                )

                expect(
                    serverSocket1001.rooms.has(
                        room1001
                    )
                ).toBe(true)

                expect(
                    serverSocket2002.rooms.has(
                        room2002
                    )
                ).toBe(true)

                await waitForAdapterPropagation()

                const gatewayA =
                    new SocketIOGateway(
                        ioA,
                        logger,
                        metrics
                    )

                const targetReceived =
                    waitForEvent(
                        match1001Client,
                        "BALL_RECORDED"
                    )

                let wrongRoomReceived = false

                match2002Client.on(
                    "BALL_RECORDED",
                    () => {
                        wrongRoomReceived = true
                    }
                )

                const payload = {
                    matchId: "1001",
                    runs: 4
                }

                gatewayA.emitToRoom(
                    room1001,
                    "BALL_RECORDED",
                    payload
                )

                const receivedPayload =
                    await targetReceived

                expect(
                    receivedPayload
                ).toEqual(payload)

                await delay(300)

                expect(
                    wrongRoomReceived
                ).toBe(false)

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
                match1001Client?.disconnect()
                match2002Client?.disconnect()

                await Promise.allSettled([
                    closeIO(ioA),
                    closeIO(ioB)
                ])

                const redisClients = [
                    subClientA,
                    pubClientA,
                    subClientB,
                    pubClientB
                ]

                for (const client of redisClients)
                {
                    if (client?.isOpen)
                    {
                        await client.quit()
                    }
                }
            }
        },
        15000
    )
})

function waitForConnection(client)
{
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

async function waitForAdapterPropagation()
{
    await delay(100)
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

// DIP — application-facing behavior is tested through SocketIOGateway.
// LSP — the concrete gateway preserves the WebSocketGateway contract.
// Adapter Pattern — Valkey transparently connects independent Socket.IO instances.
// Test Isolation — connection-handler behavior isn't mixed into gateway testing.
// SRP — gateway emission and subscription management remain separate.
// Resource Safety — clients, servers, publishers, and subscribers are cleaned up in finally.
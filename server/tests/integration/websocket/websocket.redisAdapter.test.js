import { describe, it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

import SocketIOAdapterClientFactory
    from "../../../src/websocket/SocketIOAdapterClientFactory.js";

import SocketIORedisAdapter
    from "../../../src/websocket/SocketIORedisAdapter.js";

import WebSocketRooms
    from "../../../src/websocket/WebSocketRooms.js";


describe("Socket.IO Redis Adapter Integration", () => {

    it(
        "should deliver a room event across two Socket.IO server instances",
        async () => {

            const redisUrl =
                process.env.TEST_REDIS_URL

            expect(redisUrl).toBeTruthy()

            const logger = {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn()
            }

            const httpServerA = createServer()
            const httpServerB = createServer()

            const ioA = new Server(httpServerA, {
                cors: {
                    origin: "*"
                }
            })

            const ioB = new Server(httpServerB, {
                cors: {
                    origin: "*"
                }
            })

            const clientFactoryA =
                new SocketIOAdapterClientFactory(
                    redisUrl,
                    logger
                )

            const clientFactoryB =
                new SocketIOAdapterClientFactory(
                    redisUrl,
                    logger
                )

            let pubClientA
            let subClientA
            let pubClientB
            let subClientB
            let clientB

            try
            {
                ({
                    pubClient: pubClientA,
                    subClient: subClientA
                } = await clientFactoryA.create())

                ;({
                    pubClient: pubClientB,
                    subClient: subClientB
                } = await clientFactoryB.create())

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

                clientB = createClient(
                    `http://localhost:${portB}`,
                    {
                        transports: ["websocket"],
                        forceNew: true,
                        reconnection: false
                    }
                )

                await new Promise((resolve, reject) => {
                    clientB.once("connect", resolve)
                    clientB.once("connect_error", reject)
                })

                const room =
                    WebSocketRooms.match("1001")

                /*
                 * This test is specifically testing the
                 * distributed adapter, not our
                 * SocketConnectionHandler.
                 *
                 * Therefore Server B directly joins its
                 * connected socket to the room.
                 */
                const serverSocketB =
                    ioB.sockets.sockets.get(clientB.id)

                expect(serverSocketB).toBeDefined()

                await serverSocketB.join(room)

                const receivedEvent =
                    new Promise((resolve, reject) => {

                        const timeout =
                            setTimeout(() => {
                                reject(
                                    new Error(
                                        "Cross-instance event was not received"
                                    )
                                )
                            }, 5000)

                        clientB.once(
                            "BALL_RECORDED",
                            payload => {
                                clearTimeout(timeout)
                                resolve(payload)
                            }
                        )
                    })

                const payload = {
                    matchId: "1001",
                    score: {
                        runs: 151,
                        wickets: 3
                    }
                }

                /*
                 * IMPORTANT:
                 *
                 * Event originates from Server A.
                 * Client is connected to Server B.
                 */
                ioA
                    .to(room)
                    .emit(
                        "BALL_RECORDED",
                        payload
                    )

                const receivedPayload =
                    await receivedEvent

                expect(receivedPayload)
                    .toEqual(payload)
            }
            finally
            {
                if (clientB)
                {
                    clientB.disconnect()
                }

                await Promise.allSettled([
                    new Promise(resolve =>
                        ioA.close(() => resolve())
                    ),

                    new Promise(resolve =>
                        ioB.close(() => resolve())
                    )
                ])

                const clients = [
                    subClientA,
                    pubClientA,
                    subClientB,
                    pubClientB
                ]

                for (const client of clients)
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

// Adapter Pattern — Redis/Valkey bridges independent Socket.IO instances.
// Test Isolation — the test isolates distributed WebSocket delivery from business processing.
// SRP — room joining, adapter coordination, and application services are tested separately.
// DI — Redis URL and logger are supplied to the client factory.
// DIP — no CricZone business service depends directly on Redis Pub/Sub.
// Resource Safety — clients, Socket.IO servers, and Valkey connections are cleaned up in finally.
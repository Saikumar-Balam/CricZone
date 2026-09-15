import { describe, it, expect, vi } from "vitest"
import { createServer } from "node:http"
import { Server } from "socket.io"
import { io as createClient } from "socket.io-client"

import SocketConnectionHandler from
    "../../../src/websocket/SocketConnectionHandler.js"

describe("WebSocket Disconnect Integration", () => {

    it("should handle client disconnect", async () => {

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

            const clientId = client.id

            expect(client.connected)
                .toBe(true)

            /*
             * Connection itself calls setGauge(),
             * so clear it before testing disconnect.
             */
            metrics.setGauge.mockClear()

            /*
             * Create a deterministic signal from the
             * server-side disconnect handler.
             */
            const disconnected =
                new Promise((resolve, reject) => {

                    const timeout =
                        setTimeout(() => {

                            reject(
                                new Error(
                                    "Server disconnect handler timed out"
                                )
                            )

                        }, 5000)

                    io.sockets.sockets
                        .get(clientId)
                        .once(
                            "disconnect",
                            reason => {

                                clearTimeout(timeout)

                                resolve(reason)
                            }
                        )
                })

            client.disconnect()

            const reason =
                await disconnected

            expect(client.connected)
                .toBe(false)

            expect(reason)
                .toBeDefined()

            expect(
                metrics.setGauge
            ).toHaveBeenCalledWith(
                "websocket_connected_clients",
                expect.any(Number)
            )

            expect(
                logger.info
            ).toHaveBeenCalledWith(
                "Websocket client disconnected",
                expect.objectContaining({
                    socketId: clientId,
                    reason: expect.any(String)
                })
            )

        } finally {

            if (client?.connected) {
                client.disconnect()
            }

            await new Promise(resolve => {
                io.close(() => resolve())
            })
        }

    }, 10000)
})

// SRP — Test focuses only on disconnect lifecycle.
// DI — Logger and metrics are injected.
// DIP — Handler doesn't construct observability infrastructure.
// Observer Pattern — Socket.IO disconnect event triggers lifecycle handling.
// Encapsulation — Disconnect behavior stays within SocketConnectionHandler.
// Separation of Concerns — Disconnect lifecycle remains separate from room membership and event broadcasting.
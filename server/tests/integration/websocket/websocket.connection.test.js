import {describe, it, expect, vi} from "vitest"
import {createServer} from "node:http"
import {Server} from "socket.io"
import {io as createClient} from "socket.io-client"
import SocketConnectionHandler from "../../../src/websocket/SocketConnectionHandler.js"

describe("WebSocket Client Connection Integration", () => {

    it("should connect a Socket.IO client", async () => {
        const httpServer = createServer()
        const io = new Server(httpServer, {
            cors:{
                origin: "*"
            }
        })
        // mock or fake calls
        const logger = {
            info: vi.fn(),
            debug: vi.fn(),
            error: vi.fn()
        }
        const metrics = {
            setGauge: vi.fn(),
            incrementCounter: vi.fn()
        }

        const connectionHandler = new SocketConnectionHandler(logger, metrics)
        io.on("connection", connectionHandler.handle)
        let client 
        try {
            await new Promise(resolve =>{
                httpServer.listen(0, resolve)
            })
            const address = httpServer.address()
            const port = address.port
            client = createClient(`http://localhost:${port}`,{
                transports:["websocket"],
                forceNew: true,
                reconnection: false
            })
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Socket.IO client connection timed out"))
                }, 5000)
            client.on("connect", () => {
                clearTimeout(timeout)
                resolve()
            })
            client.on("connect_error", error => {
                clearTimeout(timeout)
                reject(error)
            })
            })
            expect(client.connected).toBe(true)
            expect(client.id).toBeDefined()
            expect(logger.info).toHaveBeenCalledWith("Websocket client connected", expect.objectContaining({
                socketId: expect.any(String)
            }))
            expect(metrics.setGauge).toHaveBeenCalledWith("websocket_connected_clients", expect.any(Number))
        }
        finally {
            if(client)
            {
                client.disconnect()
            }
            if(httpServer.listening)
            {
                await new Promise(resolve =>{
                    httpServer.close(resolve)
                })
            }
        }
    }, 10000)
})

// SRP — Test verifies client connection behavior only.
// DI — Logger and metrics are injected into SocketConnectionHandler.
// DIP — Connection handler doesn't construct concrete observability dependencies.
// Test Doubles — Logger and metrics are mocked while networking remains real.
// Observer Pattern — Socket.IO connection event invokes the handler.
// Separation of Concerns — Connection lifecycle is tested separately from room broadcasting.
// Encapsulation — Connection behavior remains inside SocketConnectionHandler.
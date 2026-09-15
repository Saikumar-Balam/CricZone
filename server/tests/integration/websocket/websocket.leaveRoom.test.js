import { describe,it, vi, expect } from "vitest";
import {createServer} from "node:http"
import {Server} from "socket.io"
import {io as createClient} from "socket.io-client"

import SocketConnectionHandler from "../../../src/websocket/SocketConnectionHandler.js";

describe("WebSocket Leave Room Integration", () => {
    it("should allow clients to leave room", async () => {
        const httpServer = createServer()
        const io = new Server(httpServer, {
            cors:{
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
        const connectionHandler = new SocketConnectionHandler(logger, metrics)
        io.on("connection", connectionHandler.handle)
        let client
        try{
            await new Promise(resolve => {
                httpServer.listen(0, resolve)
            })
            const port = httpServer.address().port
            client = createClient(`http://localhost:${port}`, {
                transports: ["websocket"],
                forceNew: true,
                reconnection: false
            })
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(()=>{
                    reject(new Error("Socket.IO client connection timed out"))
                }, 5000)
                client.on("connect", () => {
                    clearTimeout(timeout)
                    resolve()
                })
                client.on("connect_error", error =>{
                    clearTimeout(timeout)
                    reject(error)
                })
            })
            const matchId = 1001
            const room = `match:${matchId}`
            // 1st join the romm
            client.emit("join-match", matchId)
            await new Promise(resolve => 
                setTimeout(resolve, 100)
            )
            // verify precondition
            // client must actually be inside the room
            let sockets = await io.in(room).fetchSockets()
            expect(sockets).toHaveLength(1)
            expect(sockets[0].id).toBe(client.id)
            client.emit("leave-match", matchId)
            await new Promise(resolve =>
                setTimeout(resolve, 100)
            )
            // room should now contain no client
            sockets = await io.in(room).fetchSockets()
            expect(sockets).toHaveLength(0)
            expect(logger.info).toHaveBeenCalledWith("Websocket client left match room",expect.objectContaining({
                socketId: client.id,
                matchId,
                room
            }))
        }
        finally {
            if(client)
            {
                client.disconnect()
            }
            await new Promise(resolve =>{
                io.close(()=>resolve())
            })
        }
    }, 10000)
})

// SRP — This test verifies room-leaving behavior only.
// DI — Logger and metrics are injected.
// DIP — Handler doesn't construct its observability dependencies.
// Observer Pattern — leave-match triggers the registered event handler.
// Encapsulation — Room lifecycle logic stays inside SocketConnectionHandler.
// Separation of Concerns — Leaving is tested independently from broadcasting and live-event delivery.
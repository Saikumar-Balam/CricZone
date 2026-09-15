import { describe, it, expect, vi } from "vitest";
import {createServer} from "node:http"
import {Server} from "socket.io"
import {io as createClient} from "socket.io-client"
import SocketConnectionHandler from "../../../src/websocket/SocketConnectionHandler.js";

describe("WebSocket Join Room Integration", () => {
    it("should allow client to join a match room", async () => {
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
            client = createClient(`http://localhost:${port}`,{
                transports: ["websocket"],
                forceNew: true,
                reconnection: false
            })
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() =>{
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
            client.emit("join-match", matchId)
            await new Promise(resolve =>
                setTimeout(resolve, 100)
            )
            const sockets = await io.in(room).fetchSockets()
            expect(sockets).toHaveLength(1)
            expect(sockets[0].id).toBe(client.id)
            expect(sockets[0].rooms.has(room)).toBe(true)
            expect(logger.info).toHaveBeenCalledWith("Websocket client joined match room", expect.objectContaining({
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
                io.close(()=> resolve())
            })
        }
    }, 10000)
})

// SRP — Tests only match-room joining.
// DI — Logger and metrics injected.
// DIP — Handler doesn't construct observability dependencies.
// Observer Pattern — join-match event triggers room handling.
// Encapsulation — Room naming/management remains in SocketConnectionHandler.
// Separation of Concerns — Connection, joining, leaving, and broadcasting are tested separately.
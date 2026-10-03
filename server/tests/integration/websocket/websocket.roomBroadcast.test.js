import { describe, it, vi, expect } from "vitest";
import {createServer} from "node:http"
import {Server} from "socket.io"
import {io as createClient} from "socket.io-client"
import SocketConnectionHandler from "../../../src/websocket/SocketConnectionHandler.js";
import SocketIOGateway from "../../../src/websocket/SocketIOGateway.js";
import WebSocketRooms from "../../../src/websocket/WebSocketRooms.js";


describe("WebSocket Room Broadcast Integration", () => {
    it("should emit event only to clients inside the match room", async () => {
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
        const gateway = new SocketIOGateway(io, logger, metrics)
        io.on("connection", connectionHandler.handle)
        let roomClient
        let outsideClient
        try {
            await new Promise(resolve =>{
                httpServer.listen(0, resolve)
            })
            const port = httpServer.address().port
            const url = `http://localhost:${port}`
            roomClient = createClient(url, {
                transports: ["websocket"],
                forceNew: true,
                reconnection: false
            })
            outsideClient = createClient(url, {
                transports: ["websocket"],
                forceNew: true,
                reconnection: false
            })

            await Promise.all([
                new Promise((resolve, reject) =>{
                    roomClient.on("connect", resolve)
                    roomClient.on("connect_error", reject)
                }),
                new Promise((resolve, reject) => {
                    outsideClient.on("connect", resolve)
                    outsideClient.on("connect_error", reject)
                })
            ])
            const matchId = "1001"
            const room = `match:${matchId}`
            roomClient.emit("join-match", matchId)
            await new Promise(resolve =>
                setTimeout(resolve, 100)
            )
            const sockets = await io.in(room).fetchSockets()
            expect(sockets).toHaveLength(1)
            expect(sockets[0].id).toBe(roomClient.id)
            const payload = {
                matchId,
                score: 150,
                wickets: 3
            }
            let outsideReceived = false
            outsideClient.on("score-update", () =>{
                outsideReceived = true
            })
            const roomEventReceived = new Promise((resolve, reject) => {
                const timeout = setTimeout(() =>{
                    reject(new Error("Room client did not receive event"))
                }, 5000)
                roomClient.once("score-update", receivedpayload =>{
                    clearTimeout(timeout)
                    resolve(receivedpayload)
                })
            })
            gateway.emitToRoom(room, "score-update", payload)
            const receivedPayload = await roomEventReceived
            expect(receivedPayload).toEqual(payload)
            await new Promise(resolve =>
                setTimeout(resolve, 100)
            )
            expect(outsideReceived).toBe(false)
            expect(metrics.incrementCounter).toHaveBeenCalledWith("websocket_emit_total",1, {
                scope: "room",
                event_type: "score-update"
            })
            expect(logger.debug).toHaveBeenCalledWith("Websocket event emitted to room", {
                room,
                event: "score-update"
            })
        }
        finally {
            if(roomClient)
            {
                roomClient.disconnect()
            }
            if(outsideClient)
            {
                outsideClient.disconnect()
            }
            await new Promise(resolve =>{
                io.close(()=>resolve())
            })
        }
    }, 10000)
    it("should support one client subscribing to multiple match rooms", async () => {

    const httpServer = createServer()

    const io = new Server(httpServer, {
        cors: {
            origin: "*"
        }
    })

    const logger = {
        info: vi.fn(),
        warn: vi.fn(),
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

    try
    {
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
            client.on("connect", resolve)
            client.on("connect_error", reject)
        })

        client.emit("join-match", "1001")
        client.emit("join-match", "2002")

        await new Promise(resolve =>
            setTimeout(resolve, 100)
        )

        const room1001 =
            WebSocketRooms.match("1001")

        const room2002 =
            WebSocketRooms.match("2002")

        const match1001Sockets =
            await io.in(room1001).fetchSockets()

        const match2002Sockets =
            await io.in(room2002).fetchSockets()

        expect(match1001Sockets).toHaveLength(1)
        expect(match2002Sockets).toHaveLength(1)

        expect(
            match1001Sockets[0].id
        ).toBe(client.id)

        expect(
            match2002Sockets[0].id
        ).toBe(client.id)
    }
    finally
    {
        if (client)
        {
            client.disconnect()
        }

        await new Promise(resolve => {
            io.close(() => resolve())
        })
    }

}, 10000)
})

// SRP — SocketIOGateway handles WebSocket emission, while SocketConnectionHandler handles room lifecycle.
// DI — Socket.IO, logger, and metrics are injected.
// DIP — Gateway depends on its injected collaborators rather than creating them.
// Abstraction — SocketIOGateway implements your WebSocketGateway contract.
// LSP — Concrete SocketIOGateway fulfills the gateway abstraction.
// Observer Pattern — Clients subscribe to Socket.IO events.
// Separation of Concerns — Room membership and room emission remain separate.
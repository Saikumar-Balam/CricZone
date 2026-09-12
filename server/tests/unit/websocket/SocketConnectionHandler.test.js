import { describe, it, expect, vi, beforeEach } from "vitest";
import SocketConnectionHandler from "../../../src/websocket/SocketConnectionHandler.js";

describe("SocketConnectionHandler", () =>{
    let logger
    let metrics 
    let handler
    let socket
    let eventHandlers

    beforeEach(() => {
        eventHandlers = {}
        logger = {
            info: vi.fn()
        }
        metrics = {
            setGauge: vi.fn()
        }
        socket = {
            id: "socket-123",
            server: {
                engine: {
                    clientsCount: 5
                }
            },
            on: vi.fn((event, callback) => {
                eventHandlers[event] = callback
            }),
            join: vi.fn(),
            leave: vi.fn()
        }
        handler = new SocketConnectionHandler(logger, metrics)
    })

    it("should handle new WebSocket connection", ()=> {
        handler.handle(socket)
        expect(metrics.setGauge).toHaveBeenCalledWith("websocket_connected_clients", 5)
        expect(logger.info).toHaveBeenCalledWith("Websocket client connected", {
            socketId: "socket-123"
        })
        expect(socket.on).toHaveBeenCalledWith("leave-match", expect.any(Function))
        expect(socket.on).toHaveBeenCalledWith("disconnect", expect.any(Function))
    })

    it("should join match room", () => {
        handler.handle(socket)
        eventHandlers["join-match"]("456")
        expect(socket.join).toHaveBeenCalledWith("match:456")
        expect(logger.info).toHaveBeenCalledWith("Websocket client joined match room", {
            socketId: "socket-123",
            matchId: "456",
            room: "match:456"
        })
    })
    it("should leave match room", () => {
        handler.handle(socket)
        eventHandlers["leave-match"]("456")
        expect(socket.leave).toHaveBeenCalledWith("match:456")
        expect(logger.info).toHaveBeenCalledWith("Websocket client left match room", {
            socketId: "socket-123",
            matchId: "456",
            room: "match:456"
        })
    })
    it("should handle WebSocket disconnect", () => {
        handler.handle(socket)
        socket.server.engine.clientsCount = 4
        eventHandlers.disconnect("transport close")
        expect(metrics.setGauge).toHaveBeenCalledWith("websocket_connected_clients", 4)
        expect(logger.info).toHaveBeenCalledWith("Websocket client disconnected", {
            socketId: "socket-123",
            reason: "transport close"
        })
    })
})

// SRP
// Handles socket lifecycle and room membership only.
//
// DI
// Logger and Metrics are constructor injected.
//
// Separation of Concerns
// Connection lifecycle is separated from event broadcasting.
//
// Encapsulation
// Room naming and socket lifecycle behavior remain
// inside the WebSocket layer.
//
// Testability
// Socket, logger and metrics can be mocked.
//
// Observability
// Connection count and lifecycle events are recorded.
import { describe, it, expect, vi, beforeEach } from "vitest";
import SocketIOGateway from "../../../src/websocket/SocketIOGateway.js";

describe("SocketIOGateway", () => {
    let io
    let logger
    let metrics
    let gateway

    beforeEach(() => {
        io ={
            emit: vi.fn(),
            to: vi.fn()
        }
        logger = {
            debug: vi.fn(),
            error: vi.fn()
        }
        metrics = {
            incrementCounter: vi.fn()
        }
        gateway = new SocketIOGateway(io, logger, metrics)
    })

    it("should broadcast event to all connected clients", () => {
        const event = "MATCH_UPDATED"
        const payload = {
            matchId: "match-123",
            score: 150
        }
        gateway.broadcast(event, payload)
        expect(io.emit).toHaveBeenCalledWith(event, payload)
        expect(metrics.incrementCounter).toHaveBeenCalledWith("websocket_emit_total",1, {
            scope: "broadcast",
            event_type: event
        })
        expect(logger.debug).toHaveBeenCalledWith("WebSocket event broadcast", {
            event
        })
    })

    it("should record failure metrics When broadcast fails", () => {
        const error = new Error("Socket.IO broadcast failed")
        io.emit.mockImplementation(() =>{
            throw error 
        })

        expect(() => {
            gateway.broadcast("MATCH_UPDATED", {
                score: 100
            })
        }).toThrow(error)

        expect(metrics.incrementCounter).toHaveBeenCalledWith("websocket_emit_failures_total", 1, {
            scope: "broadcast",
            event_type: "MATCH_UPDATED"
        })
        expect(logger.error).toHaveBeenCalledWith("WebSocket broadcast failed", expect.objectContaining({
            event: "MATCH_UPDATED",
            errorMessage: "Socket.IO broadcast failed"
        }))
    })
    
    it("should emit event to a specific room", () => {
        const room = "match:123"
        const event = "BALL_RECORDED"
        const payload = {
            runs: 4
        }
        const roomEmitter = {
            emit: vi.fn()
        }
        io.to.mockReturnValue(roomEmitter)
        gateway.emitToRoom(room, event, payload)
        expect(io.to).toHaveBeenCalledWith(room)
        expect(metrics.incrementCounter).toHaveBeenCalledWith("websocket_emit_total", 1, {
            scope: "room",
            event_type: event
        })
        expect(logger.debug).toHaveBeenCalledWith("Websocket event emitted to room", {
            room, 
            event
        })
    })

    it("should record failure metrics when room emission fails", () => {
        const room = "match:123"
        const event = "BALL_RECORDED"
        const error = new Error("Room emission failed")
        const roomEmitter = {
            emit: vi.fn(()=>{
                throw error
            })
        }
        io.to.mockReturnValue(roomEmitter)
        expect(()=>{
            gateway.emitToRoom(room, event, {
                runs: 6
            })
        }).toThrow(error)
        expect(metrics.incrementCounter).toHaveBeenCalledWith("websocket_emit_failures_total", 1, {
            scope: "room",
            event_type: event
        })
        expect(logger.error).toHaveBeenCalledWith("WebSocket room emission failed", expect.objectContaining({
            room,
            event,
            errorMessage: "Room emission failed"
        }))
    })
})

// SRP
// Translates application WebSocket operations into Socket.IO calls.
//
// Abstraction
// Implements the generic WebSocketGateway contract.
//
// LSP
// Can substitute another valid WebSocketGateway implementation.
//
// DIP
// Higher-level services depend on WebSocketGateway abstraction,
// not Socket.IO directly.
//
// OCP
// Another gateway implementation can be introduced without
// changing LiveUpdateService.
//
// DI
// Socket.IO, logger and metrics are injected.
//
// Testability
// All collaborators can be replaced by mocks.
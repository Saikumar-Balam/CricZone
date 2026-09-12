import WebSocketGateway from "./contracts/WebSocketGateway.js";

export default class SocketIOGateway extends WebSocketGateway 
{
    constructor(io, logger, metrics)
    {
        super()
        this.io = io
        this.logger = logger
        this.metrics = metrics
    }

    broadcast(event, payload)
    {
        try{
        this.io.emit(event, payload)
        this.metrics.incrementCounter("websocket_emit_total", 1, {
            scope: "broadcast",
            event_type: event
        })

        this.logger.debug("WebSocket event broadcast", {
            event
        })
    }
    catch(error)
    {
        this.metrics.incrementCounter("websocket_emit_failures_total", 1, {
            scope: "broadcast",
            event_type: event
        })
        this.logger.error("WebSocket broadcast failed", {
            event,
            errorMessage: error.message
        })
        throw error
    }
    }

    emitToRoom(room, event, payload)
    {
        try{
        this.io.to(room).emit(event, payload)
        this.metrics.incrementCounter("websocket_emit_total", 1, {
            scope: "room",
            event_type: event
        })

        this.logger.debug("Websocket event emitted to room", {room,
            event
        })
    }
    catch(error)
    {
        this.metrics.incrementCounter("websocket_emit_failures_total", 1, {
            scope: "room",
            event_type: event
        })
        this.logger.error("WebSocket room emission failed", {
            room,event,
            errorMessage: error.message
        })
        throw error
    }
}
}

// Dependency Injection 
// DIP                  
// SRP                  
// LSP                  
// OCP                  
// Abstraction          


// SocketIOGateway's only responsibility is translating our generic gateway operations:

// broadcast(...)
// emitToRoom(...)

// into Socket.IO operations:
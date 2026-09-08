import WebSocketGateway from "./contracts/WebSocketGateway.js";

export default class SocketIOGateway extends WebSocketGateway 
{
    constructor(io, logger)
    {
        super()
        this.io = io
        this.logger = logger
    }

    broadcast(event, payload)
    {
        this.io.emit(event, payload)

        this.logger.debug("Websocket event broadcast", {
            event
        })
    }

    emitToRoom(room, event, payload)
    {
        this.io.to(room).emit(event, payload)

        this.logger.debug("Websocket event emitted to room", {room,
            event
        })
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
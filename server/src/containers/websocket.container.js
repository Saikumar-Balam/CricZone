import {Server} from "socket.io"
import SocketIOGateway from "../websocket/SocketIOGateway.js"
import SocketConnectionHandler from "../websocket/SocketConnectionHandler.js"
import {logger} from "./logger.container.js"

export const createWebSocketInfrastructure = (httpServer) => {
    const io = new Server(httpServer, {
        cors:{
            origin: "http://localhost:5173",
            methods: [
                "GET" , 
                "POST"
        ]
        }
    })

    const webSocketGateway = new SocketIOGateway(io, logger)

    const socketConnectionHandler = new SocketConnectionHandler(logger)

    io.on("connection", socketConnectionHandler.handle)

    return {
        io,
        webSocketGateway,
        socketConnectionHandler
    }
}
// SRP                  
// Dependency Injection 
// DIP                  
// Factory Pattern      
// Composition Root     
// Separation of Concerns 
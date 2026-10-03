import {Server} from "socket.io"
import SocketIOGateway from "../websocket/SocketIOGateway.js"
import SocketConnectionHandler from "../websocket/SocketConnectionHandler.js"
import {logger} from "./logger.container.js"
import { metrics } from "./metrics.container.js"
import SocketIOAdapterClientFactory from "../websocket/SocketIOAdapterClientFactory.js"
import SocketIORedisAdapter from "../websocket/SocketIORedisAdapter.js"

export const createWebSocketInfrastructure = async(httpServer, redisUrl) => {
    const io = new Server(httpServer, {
        cors:{
            origin: "http://localhost:5173",
            methods: [
                "GET" , 
                "POST"
        ]
        }
    })
    const adapterClientFactory = new SocketIOAdapterClientFactory(redisUrl, logger, metrics)
    const {pubClient, subClient} = await adapterClientFactory.create()
    const redisAdapter = new SocketIORedisAdapter(logger)
    redisAdapter.attach(io, pubClient, subClient)

    const webSocketGateway = new SocketIOGateway(io, logger, metrics)

    const socketConnectionHandler = new SocketConnectionHandler(logger, metrics)

    io.on("connection", socketConnectionHandler.handle)

    return {
        io,
        webSocketGateway,
        socketConnectionHandler,
        pubClient,
        subClient
    }
}
// SRP                  
// Dependency Injection 
// DIP                  
// Factory Pattern      
// Composition Root     
// Separation of Concerns 

// Factory Pattern — WebSocket infrastructure is assembled through one factory.
// SRP — client factory creates connections; adapter class attaches them; gateway emits events.
// DI — io, logger, metrics and Redis URL are supplied rather than hidden inside business logic.
// DIP — LiveUpdateService remains dependent on WebSocketGateway.
// Composition Root — concrete infrastructure is assembled at the application's outer boundary.
// Separation of Concerns — Kafka, cache, Socket.IO and distributed Socket.IO coordination remain separate.
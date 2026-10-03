import WebSocketRooms from "./WebSocketRooms.js"

export default class SocketConnectionHandler {
    constructor(logger, metrics)
    {
        this.logger = logger
        this.metrics = metrics 
        this.handle = this.handle.bind(this)
    }

    handle(socket)
    {
        this.metrics.setGauge("websocket_connected_clients", 
            socket.server.engine.clientsCount)

        this.metrics.incrementCounter("websocket_connections_total", 1)
        
        

        this.logger.info("Websocket client connected", {
            socketId: socket.id
        })

        socket.on("join-match", (matchId) => {
            // private method
            if(!this.#isValidMatchId(matchId))
            {
                this.metrics.incrementCounter("websocket_invalid_subscriptions_total", 1, { action: "join"})
                this.logger.warn("Invalid WebSocket match room subscription", {
                    socketId: socket.id,
                    matchId
                })
                return 
            }
            const room = WebSocketRooms.match(matchId)
            socket.join(room)
            this.metrics.incrementCounter("websocket_room_joins_total", 1)
            this.logger.info("Websocket client joined match room",{
                socketId: socket.id,
                matchId,
                room
            })
        })

        socket.on("leave-match", (matchId) => {
            if(!this.#isValidMatchId(matchId))
            {
                this.metrics.incrementCounter("websocket_invalid_subscriptions_total", 1, {action: "leave"})
                this.logger.warn("Invalid WebSocket match room unsubscription", {
                    socketId: socket.id,
                    matchId
                })
                return 
            }
            const room = WebSocketRooms.match(matchId)
            socket.leave(room)
            this.metrics.incrementCounter("websocket_room_leaves_total", 1)
            this.logger.info("Websocket client left match room",{
                socketId: socket.id,
                matchId,
                room
            })
        })

        socket.on("disconnect", (reason) => {
            this.metrics.setGauge("websocket_connected_clients",
                socket.server.engine.clientsCount)

            this.metrics.incrementCounter("websocket_disconnections_total", 1, { reason})

            this.logger.info("Websocket client disconnected", {
                socketId: socket.id,
                reason
            })
        })
       
    }
     #isValidMatchId(matchId)
        {
            if(typeof matchId !== "string")
            {
                return false
            }
            return matchId.trim().length > 0
        }
}
// SRP — only handles socket connection/room lifecycle.
// Separation of concerns — room management is separate from broadcasting.
// DI — logger is injected.
// Encapsulation — room naming/connection behavior stays inside the WebSocket layer.
// Observability
// Connected client count is exposed through metrics.

// SRP — WebSocketRooms only defines room naming.
// DRY — match:${matchId} is defined once.
// Encapsulation — infrastructure naming convention is centralized.
// OCP — future rooms such as series:* or team:* can be added without scattering conventions.
// Separation of Concerns — validation remains separate from room-name construction.

// SRP — connection lifecycle metrics stay with the connection handler.
// DI — metrics remains injected.
// DIP — handler uses the metrics abstraction rather than a specific monitoring system.
// Observability — gauge tracks current clients; counters track connection churn.
// Separation of Concerns — no room/subscription behavior is changed in this step.

// SRP — subscription metrics stay with the component owning join/leave behavior.
// DI/DIP — the handler continues using the injected metrics abstraction.
// Encapsulation — room construction remains inside WebSocketRooms.
// Observability — valid and invalid subscription activity becomes measurable.
// Low-cardinality design — matchId, room, and socketId are deliberately excluded from metric labels.
// Separation of Concerns — logs retain diagnostic identifiers while metrics provide aggregate operational data.
export default class SocketConnectionHandler {
    constructor(logger)
    {
        this.logger = logger
        this.handle = this.handle.bind(this)
    }

    handle(socket)
    {
        this.logger.info("Websocket client connected", {
            socketId: socket.id
        })

        socket.on("join-match", (matchId) => {
            const room = `match:${matchId}`
            socket.join(room)
            this.logger.info("Websocket client joined match room",{
                socketId: socket.id,
                matchId,
                room
            })
        })

        socket.on("leave-match", (matchId) => {
            const room = `match:${matchId}`
            socket.leave(room)
            this.logger.info("Websocket client left match room",{
                socketId: socket.id,
                matchId,
                room
            })
        })

        socket.on("disconnect", (reason) => {
            this.logger.info("Websocket client disconnected", {
                socketId: socket.id,
                reason
            })
        })
    }
}
// SRP — only handles socket connection/room lifecycle.
// Separation of concerns — room management is separate from broadcasting.
// DI — logger is injected.
// Encapsulation — room naming/connection behavior stays inside the WebSocket layer.
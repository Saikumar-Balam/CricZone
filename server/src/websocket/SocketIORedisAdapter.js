import {createAdapter} from "@socket.io/redis-adapter"
export default class SocketIORedisAdapter {
    constructor(logger)
    {
        this.logger = logger 
    }

    attach(io, pubClient, subClient)
    {
        io.adapter(createAdapter(pubClient, subClient))
        this.logger.info("Socket.IO Redis adapter attached")
    }
}

// SRP — this class only attaches the distributed Socket.IO adapter.
// DI — io, publisher and subscriber clients are supplied externally.
// DIP — high-level services remain independent of Redis/Valkey.
// Adapter Pattern — Redis adapter enables Socket.IO instances to coordinate.
// Separation of Concerns — connection creation and adapter configuration remain separate.
// Composition Root — actual construction/wiring remains outside this class.
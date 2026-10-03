import {createClient} from "redis"
export default class SocketIOAdapterClientFactory {
    constructor(redisUrl, logger, metrics)
    {
        this.redisUrl = redisUrl
        this.logger = logger
        this.metrics = metrics
    }

    async create()
    {
        const pubClient = createClient({url: this.redisUrl})
        const subClient = pubClient.duplicate()

        this.#registerRuntimeListener(pubClient, "publisher")
        this.#registerRuntimeListener(subClient, "subscriber")
        try {
        await Promise.all([
            pubClient.connect(),
            subClient.connect()
        ])

        this.logger.info("Socket.IO Redis adapter clients connected")
        return {pubClient, subClient}
    }
    catch(error)
    {
        this.logger.error("Socket.IO Redis adapter connection failed", {
            errorMessage: error.message
        })
        await Promise.allSettled([this.#closeClient(pubClient),
            this.#closeClient(subClient)
        ])
        throw error
    }
}
// private method
    async #closeClient(client)
    {
        if(!client?.isOpen)
        {
            return
        }
        try {
            await client.quit()
        }
        catch{
            client.disconnect()
        }
    }

    #registerRuntimeListener(client, role)
    {
        client.on("error", (error) => {
            this.metrics.incrementCounter("websocket_adapter_errors_total",1, {role})

            this.logger.error("Socket.IO Redis adapter client error", {
                role,
                errorMessage: error.message
            })
        })

        client.on("reconnecting", () => {
            this.metrics.incrementCounter("websocket_adapter_reconnects_total", 1, { role })
            this.logger.warn("Socket.IO Redis adapter client reconnecting", { role })
        })

        client.on("ready", () => {
            this.logger.info("Socket.IO Redis adapter client ready", { role })
        })

        client.on("end", () => {
            this.logger.warn("Socket.IO Redis adapter client connection ended", { role })
        })
    }
}

// Factory Pattern — client creation is centralized.
// SRP — factory only creates Socket.IO Pub/Sub connections.
// DI — Redis URL and logger are injected.
// DIP — business services remain independent of Redis/Valkey.
// Separation of Concerns — cache and WebSocket Pub/Sub use separate connections.
// Encapsulation — Redis client construction details stay outside Socket.IO business-facing components.

// Fail Fast — don't start an instance with broken distributed WebSocket infrastructure.
// SRP — the adapter client factory owns connection establishment.
// Encapsulation — connection details remain inside the factory.
// Error Propagation — infrastructure failures are propagated to the Composition Root.
// DI — Redis URL and logger remain injected dependencies.
// Separation of Concerns — connection failure detection is handled here; partial-resource cleanup is handled next.

// Resource Ownership — factory cleans resources until ownership transfers to bootstrap.
// SRP — the factory owns creation and failed-creation cleanup.
// Failure Isolation — one cleanup failure doesn't prevent cleanup of the other client.
// Fail Fast — original startup failure is still propagated.
// Encapsulation — cleanup mechanics stay private inside the factory.
// Resource Safety — partially initialized Valkey connections aren't intentionally left open.

// Observer/Event-driven pattern — infrastructure lifecycle is observed through client events.
// SRP — the Redis client manages reconnection; CricZone observes and logs its state.
// Encapsulation — runtime listener registration stays inside the adapter-client factory.
// DRY — publisher and subscriber share one listener-registration method.
// Fault Isolation — temporary adapter problems don't introduce custom reconnect logic throughout the application.
// Separation of Concerns — Kafka provides backend event reliability; Socket.IO provides real-time delivery.
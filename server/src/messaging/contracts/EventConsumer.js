export default class EventConsumer
{
    async connect()
    {
        throw new Error("connect() must be implemented")
    }
    async subscribe(topic, handler)
    {
        throw new Error("subscribe() must be implemented")
    }

    async disconnect()
    {
        throw new Error("disconnect() must be implemented")
    }
}
// SRP - defines only event-consumer behavior.
// DIP - higher-level modules depend on this abstraction, not KafkaJS.
// OCP - new consumer implementations can be added without changing clients.
// LSP - implementations must honor the same consumer contract.
// Abstraction - hides concrete messaging infrastructure.
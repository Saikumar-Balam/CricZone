export default class EventProducer
{
    async publish(topic, event)
    {
        throw new Error("publish() must be implemented")
    }
}
// Abstraction 
// DIP         
// OCP         
// LSP         
// SRP         
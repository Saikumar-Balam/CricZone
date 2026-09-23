export default class DeadLetterPublisher {
    async publish(event, context, error)
    {
        throw new Error("publish() must be implemented")
    }
}

// DIP — consumer will depend on DeadLetterPublisher, not KafkaJS.
// SRP — dead-letter publishing has one responsibility.
// Strategy/Abstraction — DLQ implementation can change independently.
// DI — concrete publisher will be injected into the consumer.
// Open/Closed Principle — new dead-letter destinations can be added without rewriting consumer processing logic.
import DeadLetterPublisher from "./contracts/DeadLetterPublisher.js";

export default class KafkaDeadLetterPublisher extends DeadLetterPublisher{
    constructor(eventProducer, {topic = "criczone.live-events.dlq"} = {})
    {
        super()
        this.eventProducer = eventProducer
        this.topic = topic
    }

    async publish(event, context, error)
    {
        const deadLetterEvent = {
            eventId: event.eventId,
            type: "DEAD_LETTER_EVENT",
            aggregateId: event.aggregateId,
            originalEvent: {...event},
            failure: {
                errorName: error.name ?? "Error",
                errorMessage: error.message ?? "Unknown error"
            },
            source: {
                topic: context.topic,
                partition: context.partition,
                offset: context.offset,
                key: context.key
            },
            deadLetter: {
            originalEventType: event.type,
            failedAt: new Date().toISOString()
            }
        }
        return await this.eventProducer.publish(this.topic, deadLetterEvent)
    }
}

// SRP — KafkaDeadLetterPublisher only converts and publishes failed events.
// DIP — it depends on EventProducer, not raw KafkaJS.
// DI — producer and DLQ configuration are injected.
// Adapter Pattern — dead-letter semantics are adapted onto our generic event producer.
// Composition over duplication — existing reliable producer logic is reused.
// Open/Closed Principle — another DLQ destination can implement DeadLetterPublisher without changing the consumer.

// DLQ metadata
// SRP — DLQ envelope construction belongs to the DLQ publisher.
// DIP — publisher depends on EventProducer, not KafkaJS.
// DI — producer and topic configuration are injected.
// Adapter Pattern — failed events are transformed into a standardized DLQ representation.
// Separation of Concerns — diagnostic metadata is separate from consumer business logic.
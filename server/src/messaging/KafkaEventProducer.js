import EventProducer from "./contracts/EventProducer.js";

export default class KafkaEventProducer extends EventProducer
{
    constructor(kafkaProducer, logger)
    {
        super()
        this.kafkaProducer = kafkaProducer
        this.logger = logger
    }

    async publish(topic, event)
    {
        try{
            return await this.kafkaProducer.send({topic,
                messages: [{
                    key: event.aggregateId ? String(event.aggregateId) : undefined,
                    value: JSON.stringify(event)
                }]
            })
        }
        catch(error)
        {
            this.logger.error("Kafka event publish failed",{
                topic,
                eventType: event.type,
                aggregateId: event.aggregateId,
                errorMessage: error.message
            })
            throw error
        }
    }
}

// For Redis caching we used fail-open behavior.

// For Kafka publishing, we should not automatically swallow failures, because losing a live event may affect correctness.

// SRP — KafkaEventProducer only adapts event publishing.
// DIP — application code can depend on EventProducer.
// DI — KafkaJS producer and logger are constructor-injected.
// Adapter Pattern — Kafka-specific send() is hidden behind publish().
// Fail Fast — publishing errors propagate to the caller.
// Separation of Concerns — retry policy stays out of the event producer adapter.
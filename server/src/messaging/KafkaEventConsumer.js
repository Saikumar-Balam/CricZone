import EventConsumer from "./contracts/EventConsumer.js";

export default class KafkaEventConsumer extends EventConsumer
{
    constructor(kafkaConsumer, logger, metrics)
    {
        super()
        this.kafkaConsumer = kafkaConsumer
        this.logger = logger
        this.metrics = metrics
    }


    async connect()
    {
        try{
            await this.kafkaConsumer.connect()
        }
        catch(error)
        {
            this.logger.error("Kafka consumer connection failed", {
                errorMessage: error.message
            })
            throw error
        }
    }

    async subscribe(topic, handler)
    {
        try{
            await this.kafkaConsumer.subscribe({
                topic,
                fromBeginning: false
            })

            await this.kafkaConsumer.run({
                eachMessage: async({
                    topic, 
                    partition,
                    message
                }) =>{
                    const startTime = Date.now()
                    try{
                        const event = JSON.parse(message.value.toString())
                        await handler(event, {
                            topic,
                            partition,
                            offset: message.offset,
                            key: message.key?.toString()
                        })

                        this.metrics.incrementCounter("kafka_events_consumed_total", 1, {topic,
                            event_type: event.type ?? "UNKNOWN"
                        })

                        this.metrics.observeHistogram("kafka_event_processing_duration_ms", 
                            Date.now() - startTime,{
                                topic,
                                event_type:event.type ?? "UNKNOWN"
                            }
                        )
                    }
                    catch(error){
                        this.metrics.incrementCounter("kafka_event_failures_total", 1, {topic})
                        this.logger.error("Kafka event handling failed", {
                            topic,  
                            partition,
                            offset: message.offset,
                            key: message.key?.toString(),
                            errorName: error.name,
                            errorMessage: error.message,
                            stack: error.stack
                        })
                        throw error
                    }
                }
            })
        }
        catch(error)
        {
            this.logger.error("Kafka consumer subscription failed", {
                topic,
                errorMessage: error.message
            })
            throw error
        }
    }

    async disconnect()
    {
        try 
        {
        await this.kafkaConsumer.disconnect()
    }
    catch(error)
    {
        this.logger.error("Kafka consumer disconnect failed",{
            errorMessage: error.message
        })

        throw error
    }
    }
}

// SRP — only handles Kafka message consumption and conversion.
// DIP — higher-level processing still depends on EventConsumer, not KafkaJS.
// LSP — it fulfills the EventConsumer contract.
// DI — kafkaConsumer and logger are injected through the constructor.
// Separation of concerns — infrastructure consumption is separated from business event handling.
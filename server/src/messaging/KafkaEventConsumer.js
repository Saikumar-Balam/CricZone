import EventConsumer from "./contracts/EventConsumer.js";

export default class KafkaEventConsumer extends EventConsumer
{
    constructor(kafkaConsumer, logger)
    {
        super()
        this.kafkaConsumer = kafkaConsumer
        this.logger = logger
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
                    try{
                        const event = JSON.parse(message.value.toString())
                        await handler(event, {
                            topic,
                            partition,
                            offset: message.offset,
                            key: message.key?.toString()
                        })
                    }
                    catch(error){
                        this.logger.error("Kafka event handling failed", {
                            topic,
                            partition,
                            offset: message.offset,
                            errorMessage: error.message
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
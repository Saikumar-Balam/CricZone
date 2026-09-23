import EventRetryStrategy from "./contracts/EventRetryStrategy.js";

export default class KafkaConsumerRetryStrategy extends EventRetryStrategy{
    constructor({maxRetries = 3, initialDelayMs = 500, multiplier = 2, maxDelayMs = 5000} = {})
    {
        super()
        this.maxRetries = maxRetries
        this.initialDelayMs = initialDelayMs
        this.multiplier = multiplier
        this.maxDelayMs = maxDelayMs
    }

    async execute(operation)
    {
        let retryCount = 0
        while(true)
        {
            try{
                return await operation()
            }
            catch(error)
            {
                if(retryCount >= this.maxRetries)
                {
                    throw error
                }
                const delayMs = Math.min(this.initialDelayMs * (this.multiplier ** retryCount), this.maxDelayMs)
                await this.delay(delayMs)
                retryCount++
            }
        }
    }

    delay(ms)
    {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

// Strategy Pattern — retry behavior is encapsulated behind a replaceable strategy.
// SRP — KafkaEventConsumer consumes; the retry strategy decides how processing is retried.
// OCP — retry behavior can change without rewriting the consumer.
// DIP — consumer can depend on the retry abstraction instead of a concrete retry algorithm.
// Separation of Concerns — retries, offsets, idempotency, and dead-letter handling remain separate reliability mechanisms.
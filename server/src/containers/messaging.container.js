import LiveBallEventHandler from "../messaging/handlers/LiveBallEventHandler.js";
import KafkaEventConsumer from "../messaging/KafkaEventConsumer.js";
import KafkaEventProducer from "../messaging/KafkaEventProducer.js";
import { kafkaConsumer, kafkaProducer } from "./kafka.container.js";
import {logger} from "./logger.container.js"
import { metrics } from "./metrics.container.js";
import KafkaConsumerRetryStrategy from "../messaging/KafkaConsumerRetryStrategy.js";
import RedisEventIdempotencyStore from "../messaging/RedisEventIdempotencyStore.js"
import KafkaDeadLetterPublisher from "../messaging/kafkaDeadLetterPublisher.js";
import { redisClient } from "./redis.container.js";


const eventProducer = new KafkaEventProducer(kafkaProducer, logger)
const deadLetterPublisher = new KafkaDeadLetterPublisher(eventProducer, {
    topic: process.env.KAFKA_DLQ_TOPIC || "criczone.live-events.dlq"
})

const kafkaConsumerRetryStrategy = new KafkaConsumerRetryStrategy({
    maxRetries: 3, initialDelayMs: 500, multiplier: 2, maxDelayMs: 5000
})

const eventIdempotencyStore = new RedisEventIdempotencyStore(redisClient, {
    keyPrefix: "criczone:kafka:processed:",
    ttlSeconds: 86400
})

const eventConsumer = new KafkaEventConsumer(kafkaConsumer, logger, metrics, kafkaConsumerRetryStrategy, eventIdempotencyStore, deadLetterPublisher)



export {eventProducer, eventConsumer, }

// DI — kafkaConsumer and logger are injected.
// DIP — application-facing code works through KafkaEventConsumer / EventConsumer rather than directly using KafkaJS.
// SRP — object construction stays in the container.

// One subtle point: messaging.container.js is a sub-composition-root for messaging infrastructure. Your ultimate top-level composition root is still server.js / application wiring.
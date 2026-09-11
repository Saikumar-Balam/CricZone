import LiveBallEventHandler from "../messaging/handlers/LiveBallEventHandler.js";
import KafkaEventConsumer from "../messaging/KafkaEventConsumer.js";
import KafkaEventProducer from "../messaging/KafkaEventProducer.js";
import { kafkaConsumer, kafkaProducer } from "./kafka.container.js";
import {logger} from "./logger.container.js"
import { metrics } from "./metrics.container.js";


const eventProducer = new KafkaEventProducer(kafkaProducer, logger)

const eventConsumer = new KafkaEventConsumer(kafkaConsumer, logger, metrics)



export {eventProducer, eventConsumer, }

// DI — kafkaConsumer and logger are injected.
// DIP — application-facing code works through KafkaEventConsumer / EventConsumer rather than directly using KafkaJS.
// SRP — object construction stays in the container.

// One subtle point: messaging.container.js is a sub-composition-root for messaging infrastructure. Your ultimate top-level composition root is still server.js / application wiring.
import EventConsumer from "./contracts/EventConsumer.js";

export default class KafkaEventConsumer extends EventConsumer {
  constructor(kafkaConsumer, logger, metrics, retryStrategy, idempotencyStore, deadLetterPublisher) {
    super();
    this.kafkaConsumer = kafkaConsumer;
    this.logger = logger;
    this.metrics = metrics;
    this.retryStrategy = retryStrategy;
    this.idempotencyStore = idempotencyStore
    this.deadLetterPublisher = deadLetterPublisher
  }

  async connect() {
    try {
      await this.kafkaConsumer.connect();
      this.logger.info("Kafka consumer connected");
    } catch (error) {
      this.logger.error("Kafka consumer connection failed", {
        errorName: error.name,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  async subscribe(topic, handler) {
    try {
      await this.kafkaConsumer.subscribe({
        topic,
        fromBeginning: false,
      });

      await this.kafkaConsumer.run({
        autoCommit: true,
        eachMessage: async ({ topic, partition, message }) => {
          const startTime = Date.now();
          try {
            // Reject malformed kafka messages before business processing
            if (!message.value) {
              throw new Error("Kafka message value is empty");
            }
            const event = JSON.parse(message.value.toString());
            // basic event envelope validation
            if (!event || typeof event !== "object") {
              throw new Error("Invalid Kafka event");
            }
            if (!event.type) {
              throw new Error("Kafka event type is required");
            }
            if (!event.eventId) {
              throw new Error("Kafka eventId is required");
            }
            const claimed = await this.idempotencyStore.claim(event.eventId);
            if (!claimed) {
              this.logger.info("Duplicate kafka event skipped", {
                eventId: event.eventId,
                eventType: event.type,
                topic,
                partition,
                offset: message.offset,
              });
              this.metrics.incrementCounter("kafka_duplicate_events_total", 1, {
                topic,
                event_type: event.type,
              });

              return;
            }
            const context = {
              topic,
              partition,
              offset: message.offset,
              key: message.key?.toString(),
            };
            try {
              await this.retryStrategy.execute(
                () => handler(event, context),
                context,
              );
            } catch (error) {
              // handler failed even after retries preserve failed event in the DLQ before considering it handled
              try{
              await this.deadLetterPublisher.publish(event, context, error)
              }
              catch(deadLetterError)
              {
                // DLQ persistent failed 
                // Release the claim so that kafka redelivery can attempt the event again
                await this.idempotencyStore.release(event.eventId)
                this.logger.error("Kafka dead-letter publish failed", {
                  eventId: event.eventId,
                  eventType: event.type,
                  topic,
                  partition,
                  offset: message.offset,
                  errorName: deadLetterError.name,
                  errorMessage: deadLetterError.message
                })
                throw deadLetterError
              }
              // DLQ event publication succeeded
              this.metrics.incrementCounter("kafka_dead_letter_events_total", 1, {
                topic,
                event_type: event.type
              })
              this.logger.error("Kafka event moved to dead-letter topic", {
                eventId: event.eventId,
                eventType: event.type,
                topic,
                partition,
                offset: message.offset,
                errorName: error.name,
                errorMessage: error.message
              })
              return 
            }
            // record successful processing
            this.metrics.incrementCounter("kafka_events_consumed_total", 1, {
              topic,
              event_type: event.type ?? "UNKNOWN",
            });
            this.metrics.observeHistogram(
              "kafka_event_processing_duration_ms",
              Date.now() - startTime,
              {
                topic,
                event_type: event.type ?? "UNKNOWN",
              },
            );
          } catch (error) {
            // record failed processing
            this.metrics.incrementCounter("kafka_event_failures_total", 1, {
              topic,
            });
            this.logger.error("Kafka event handling failed", {
              topic,
              partition,
              offset: message.offset,
              key: message.key?.toString(),
              errorName: error.name,
              errorMessage: error.message,
              stack: error.stack,
            });
            // never silently swallow a failed kafka event
            throw error;
          }
        },
      });
    } catch (error) {
      this.logger.error("Kafka consumer subscription failed", {
        topic,
        errorName: error.name,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  

  async disconnect() {
    try {
   
      await this.kafkaConsumer.disconnect();
      this.logger.info("Kafka consumer disconnected");
    } catch (error) {
      this.logger.error("Kafka consumer disconnect failed", {
        errorName: error.name,
        errorMessage: error.message,
      });

      throw error;
    }
  }
}

// LLD principles:
//
// SRP — KafkaEventConsumer handles Kafka consumption
// and transport-level message conversion only.
//
// Adapter Pattern — KafkaJS-specific consumer behavior
// is hidden behind EventConsumer.
//
// DIP — higher-level application code depends on
// EventConsumer rather than KafkaJS.
//
// LSP — KafkaEventConsumer fulfills the
// EventConsumer contract.
//
// DI — Kafka consumer, logger and metrics are
// constructor-injected dependencies.
//
// Delegation — actual business processing is delegated
// to the supplied event handler.
//
// Separation of Concerns — Kafka transport,
// observability and business processing remain separate.
//
// Fail Fast — malformed events and handler failures
// are propagated rather than silently ignored.

// DI/DIP — consumer depends on an injected DeadLetterPublisher.
// SRP — consumer orchestrates failures; publisher owns DLQ serialization/publishing.
// Strategy/Abstraction — dead-letter destination remains replaceable.
// Fail-Safe Recovery — DLQ failure releases the claim for redelivery.
// Idempotent Consumer Pattern — successfully dead-lettered poison events retain their claim.
// Separation of Concerns — retry, deduplication, DLQ publishing, and business processing remain independent.

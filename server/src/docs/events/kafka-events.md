# CricZone Kafka Event Contract

## 1. Purpose

This document defines the Kafka event contract used by the CricZone backend for asynchronous live cricket event processing.

Kafka is responsible for transporting backend domain events between producers and consumers.

The current production event flow is:

```text
Cricket Event
      ↓
Kafka Producer
      ↓
criczone.live.ball-events
      ↓
Kafka Consumer
      ↓
Event Validation
      ↓
Redis/Valkey Idempotency
      ↓
Application Retry Strategy
      ↓
LiveBallEventHandler
      ↓
PostgreSQL Transaction
      ↓
Redis/Valkey Live Cache
      ↓
LiveUpdateService
      ↓
WebSocketGateway
      ↓
Socket.IO
      ↓
Connected Clients
```

---

# 2. Kafka Topics

The following topic constants currently exist in CricZone:

| Topic                       | Purpose                          |
| --------------------------- | -------------------------------- |
| `criczone.live.ball-events` | Live ball-by-ball cricket events |
| `criczone.match.events`     | Reserved match event topic       |
| `criczone.scorecard.events` | Reserved scorecard event topic   |
| `criczone.live-events.dlq`  | Default dead-letter topic        |

The currently established live event contract is:

```text
BALL_RECORDED
    ↓
criczone.live.ball-events
```

`criczone.match.events` and `criczone.scorecard.events` exist as topic constants, but no additional event contracts are defined for them yet.

The dead-letter topic can be configured using:

```text
KAFKA_DLQ_TOPIC
```

If it is not configured, CricZone uses:

```text
criczone.live-events.dlq
```

---

# 3. Event Envelope

Kafka domain events use a common event envelope.

```json
{
  "eventId": "uuid",
  "type": "BALL_RECORDED",
  "aggregateId": "match-id",
  "payload": {},
  "timestamp": "ISO-8601 timestamp",
  "requestId": "optional-request-id",
  "traceId": "optional-trace-id"
}
```

## Required fields

| Field         | Required  | Description                           |
| ------------- | --------- | ------------------------------------- |
| `eventId`     | Yes       | Unique UUID identifying the event     |
| `type`        | Yes       | Domain event type                     |
| `aggregateId` | Yes       | Aggregate used for event partitioning |
| `payload`     | Yes       | Event-specific domain payload         |
| `timestamp`   | Supported | Time associated with the event        |
| `requestId`   | Optional  | Request correlation identifier        |
| `traceId`     | Optional  | Distributed tracing identifier        |

Transport metadata such as Kafka topic, partition, and offset is not part of the domain event envelope.

It is handled separately by the consumer:

```text
topic
partition
offset
```

---

# 4. BALL_RECORDED Event

`BALL_RECORDED` represents a processed cricket delivery event.

The event is published to:

```text
criczone.live.ball-events
```

Its `aggregateId` represents the match:

```text
aggregateId = matchId
```

## Payload

```json
{
  "matchId": "match-id",
  "inningsId": "innings-id",
  "inningsNumber": 1,
  "battingTeamId": "team-id",
  "bowlingTeamId": "team-id",

  "overNumber": 10,
  "ballNumber": 3,

  "strikerId": "player-id",
  "nonStrikerId": "player-id",
  "bowlerId": "player-id",

  "runs": {
    "batsman": 4,
    "extras": 0,
    "total": 4
  },

  "extras": {
    "wide": 0,
    "noBall": 0,
    "bye": 0,
    "legBye": 0,
    "penalty": 0
  },

  "boundary": {
    "four": true,
    "six": false
  },

  "wicket": {
    "occurred": false,
    "type": null,
    "dismissedPlayerId": null,
    "fielderId": null,
    "dismissalText": null
  },

  "legalDelivery": true,

  "commentary": {
    "title": "FOUR",
    "text": "Boundary scored"
  },

  "currentState": {
    "strikerId": "player-id",
    "nonStrikerId": "player-id",
    "bowlerId": "player-id"
  }
}
```

The Kafka payload is intentionally richer than the WebSocket payload.

Kafka represents the backend domain event required for processing and persistence.

Socket.IO delivers the resulting live state required by frontend clients.

---

# 5. Partitioning Strategy

Kafka messages use the event aggregate as the partition key.

For `BALL_RECORDED`:

```text
aggregateId = matchId
```

The producer therefore sends:

```text
key = String(event.aggregateId)
```

Conceptually:

```text
Match A events → same aggregate key
Match B events → different aggregate key
```

This provides stable match-based partitioning according to Kafka's partition assignment for the topic.

The producer uses KafkaJS:

```text
Partitioners.DefaultPartitioner
```

---

# 6. Producer Reliability

The Kafka producer waits for Kafka to acknowledge the send operation.

Conceptually:

```text
await producer.send(...)
```

The producer:

* serializes the complete event as JSON
* uses `aggregateId` as the message key
* waits for the Kafka send operation
* returns the broker result
* logs failures
* propagates producer errors

Producer failures are not silently swallowed.

---

# 7. Consumer Configuration

The live event consumer subscribes with:

```text
fromBeginning: false
```

Therefore, a newly created consumer group starts consuming new events rather than replaying the complete topic history.

The consumer runs with:

```text
autoCommit: true
```

---

# 8. Consumer Validation

Before an event reaches its domain handler, the consumer validates the incoming Kafka message.

The consumer validates:

```text
message value exists
        ↓
valid JSON
        ↓
parsed value is an object
        ↓
event type exists
        ↓
eventId exists
        ↓
eventId is valid
```

Malformed events are rejected rather than passed into the domain processing pipeline.

---

# 9. Delivery Semantics

CricZone uses:

```text
At-least-once delivery
        +
Event idempotency
        +
Application retries
        +
Dead-letter handling
```

CricZone does **not** claim exactly-once processing.

Because Kafka events can potentially be delivered more than once, CricZone uses `eventId`-based idempotency to prevent duplicate application processing within the configured idempotency window.

---

# 10. Application Retry Strategy

Domain event handling is wrapped by an application-level retry strategy.

Configuration:

```text
maxRetries      = 3
initialDelayMs  = 500
multiplier      = 2
maxDelayMs      = 5000
```

The maximum number of handler attempts is:

```text
Initial attempt
+ Retry 1
+ Retry 2
+ Retry 3

= 4 total attempts
```

Current retry delays are:

```text
Failure
   ↓
500 ms
   ↓
Retry 1
   ↓
1000 ms
   ↓
Retry 2
   ↓
2000 ms
   ↓
Retry 3
```

The exponential delay is capped by:

```text
5000 ms
```

The current strategy does not define jitter or error classification.

---

# 11. KafkaJS Transport Retry

KafkaJS also has its own transport-level retry configuration.

```text
initialRetryTime = 300 ms
retries          = 5
factor           = 0.2
multiplier       = 2
maxRetryTime     = 30000 ms
```

These retries are different from CricZone's application-level consumer retry strategy.

```text
KafkaJS retry
    ↓
Kafka/network/broker transport failures

Application retry
    ↓
Domain event-handler processing failures
```

These two reliability mechanisms must not be treated as the same retry layer.

---

# 12. Event Idempotency

CricZone uses Redis/Valkey to prevent duplicate event processing.

Implementation:

```text
RedisEventIdempotencyStore
```

Key format:

```text
criczone:kafka:processed:{eventId}
```

Default TTL:

```text
86400 seconds
= 24 hours
```

The event claim uses an atomic Redis/Valkey operation equivalent to:

```text
SET key "processing" NX EX 86400
```

Meaning:

```text
NX → create only if the key does not already exist
EX → automatically expire the key
```

If the operation succeeds:

```text
claim() → true
```

The event may continue through the processing pipeline.

If the key already exists:

```text
claim() → false
```

The event is considered a duplicate and application processing is skipped.

The claim remains after successful event processing.

The same claim also remains after successful dead-letter publication.

Duplicate suppression is therefore bounded by the configured TTL.

There is currently no separate:

```text
processing
processed
failed
```

state machine.

The stored value remains:

```text
processing
```

until expiration unless the claim is explicitly released by the failure path.

---

# 13. Dead-Letter Handling

If event processing continues to fail after all application retries, the event is published to the dead-letter topic.

Default topic:

```text
criczone.live-events.dlq
```

Configurable through:

```text
KAFKA_DLQ_TOPIC
```

The dead-letter event uses the following structure:

```json
{
  "eventId": "same-original-event-id",
  "type": "DEAD_LETTER_EVENT",
  "aggregateId": "match-id",

  "originalEvent": {
    "...": "original Kafka event"
  },

  "failure": {
    "errorName": "Error",
    "errorMessage": "failure message"
  },

  "source": {
    "topic": "criczone.live.ball-events",
    "partition": 0,
    "offset": "123",
    "key": "match-id"
  },

  "deadLetter": {
    "originalEventType": "BALL_RECORDED",
    "failedAt": "ISO-8601 timestamp"
  }
}
```

The DLQ event preserves:

* original event
* original event ID
* aggregate ID
* failure information
* Kafka source metadata
* original event type
* failure timestamp

Because the dead-letter publisher uses the same event producer abstraction, its partition key remains:

```text
aggregateId
```

For `BALL_RECORDED`, this is the match ID.

---

# 14. Failure Flow

The complete consumer failure flow is:

```text
Kafka Message
     ↓
Validate Event
     ↓
Claim eventId in Redis/Valkey
     ↓
Duplicate?
 ┌───────┴────────┐
Yes               No
 ↓                 ↓
Skip           Execute Handler
                    ↓
                 Failure
                    ↓
                  Retry
                    ↓
              Retries Exhausted
                    ↓
               Publish DLQ
               /         \
          Success         Failure
             ↓               ↓
          Return        Release Claim
                             ↓
                         Throw Error
```

If dead-letter publication succeeds, the consumer returns after the event has been moved to the DLQ path.

If dead-letter publication itself fails, the idempotency claim is released and the error is propagated.

---

# 15. Kafka Observability

The Kafka processing pipeline exposes application metrics including:

```text
kafka_events_consumed_total
kafka_event_processing_duration_ms
kafka_event_failures_total
kafka_duplicate_events_total
kafka_dead_letter_events_total
```

These metrics provide visibility into:

* event consumption
* event processing latency
* processing failures
* duplicate suppression
* dead-letter events

High-cardinality identifiers such as individual event IDs should not be used as Prometheus metric labels.

They may instead be included in structured logs when appropriate.

---

# 16. Kafka Health and Readiness

Kafka readiness is verified through the Kafka Admin client.

CricZone performs a cluster metadata operation equivalent to:

```text
describeCluster()
```

Kafka is considered ready when cluster metadata can be retrieved and the cluster reports available brokers.

Kafka readiness contributes to the application's:

```text
GET /ready
```

dependency status.

---

# 17. Reliability Summary

The CricZone Kafka reliability model is:

```text
Stable aggregate partitioning
        +
Producer acknowledgement
        +
KafkaJS transport retries
        +
Consumer validation
        +
At-least-once processing
        +
Redis/Valkey event idempotency
        +
Application-level retries
        +
Dead-letter handling
        +
Structured logging
        +
Prometheus metrics
        +
Kafka readiness checking
```

This design provides reliable asynchronous live-event processing while keeping Kafka transport concerns, application retry behavior, idempotency, domain handling, and real-time WebSocket delivery as separate responsibilities.

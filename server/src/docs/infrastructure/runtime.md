CricZone Runtime Infrastructure
1. Purpose

This document describes the runtime infrastructure and production architecture of the CricZone backend.

CricZone uses:

Express.js
PostgreSQL
Redis / Valkey
Kafka
Socket.IO
Prometheus metrics

Each infrastructure component has a separate responsibility.

2. Runtime Architecture
                         Clients
                            │
              ┌─────────────┴─────────────┐
              │                           │
             REST                      Socket.IO
              │                           │
              ↓                           ↓
        ┌──────────────────────────────────────┐
        │          CricZone Backend            │
        │                                      │
        │  Controller → Service → Repository   │
        │                                      │
        │       LiveUpdateService              │
        │              ↓                       │
        │       WebSocketGateway               │
        └──────────────────────────────────────┘
              │          │          │
              ↓          ↓          ↓
         PostgreSQL   Redis/Valkey  Kafka

The primary responsibilities are:

Component	Responsibility
Express.js	HTTP API and middleware
PostgreSQL	Durable application data
Redis/Valkey	Cache, live state, Kafka idempotency and Socket.IO coordination
Kafka	Asynchronous domain-event transport
Socket.IO	Real-time frontend event delivery
Prometheus	Runtime/application metrics
3. PostgreSQL

PostgreSQL is CricZone's durable source of truth.

It stores persistent cricket data including matches, teams, players, innings, performances, rankings, scorecards and related domain data.

The application accesses PostgreSQL through:

Controller
    ↓
Service
    ↓
Repository
    ↓
DatabaseClient
    ↓
PostgreSQL

Repositories contain persistence-specific operations while business services remain separated from SQL implementation details.

4. PostgreSQL Connection Pool

The database client uses a connection pool.

Configuration:

DB_POOL_MAX
default = 10

DB_IDLE_TIMEOUT_MS
default = 30000

DB_CONNECTION_TIMEOUT_MS
default = 5000

DB_STATEMENT_TIMEOUT_MS
default = 10000

Conceptually:

{
  connectionString: process.env.DATABASE_URL,

  ssl: isProduction
    ? { rejectUnauthorized: true }
    : false,

  max: Number(process.env.DB_POOL_MAX || 10),

  idleTimeoutMillis:
    Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),

  connectionTimeoutMillis:
    Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),

  statementTimeoutMillis:
    Number(process.env.DB_STATEMENT_TIMEOUT_MS || 10000)
}
5. PostgreSQL Retry Strategy

Database operations that use the configured retry abstraction use:

PostgresRetryStrategy

Current configuration:

maxRetries   = 2
baseDelayMs  = 200

Retry behavior is infrastructure-level reliability behavior and should not be used to hide permanent query or business-logic errors.

6. PostgreSQL TLS

Production PostgreSQL configuration enables SSL:

ssl: {
  rejectUnauthorized: true
}

Development and test environments may use their respective configured database environments without the production SSL setting.

7. PostgreSQL Readiness

Database readiness is checked using:

SELECT 1;

A successful query indicates that the application can communicate with PostgreSQL.

The result contributes to:

GET /ready
8. Redis / Valkey

CricZone uses Redis-compatible infrastructure for several runtime responsibilities.

Redis / Valkey
│
├── Application caching
├── Live match state
├── Kafka event idempotency
├── Socket.IO pub/sub coordination
└── Readiness checking

A Valkey-compatible provider can be used because the application communicates through the Redis-compatible protocol.

9. Redis Application Client

The application Redis client is created using:

createClient({
  url: process.env.REDIS_URL
})

Redis client failures are reported through structured logging.

The application cache abstraction is:

RedisCache

This keeps caching behavior behind an application abstraction rather than spreading direct Redis commands throughout business logic.

10. Redis / Valkey TLS

Production requires the Redis URL to use TLS:

rediss://

Example format:

rediss://username:password@host:port

The exact production credentials must never be committed to source control or documentation.

11. Redis / Valkey Readiness

Readiness is checked using:

PING

A successful response indicates that the application can communicate with the configured Redis/Valkey infrastructure.

The result contributes to:

GET /ready
12. Kafka

Kafka is CricZone's asynchronous backend event transport.

Current live-event processing:

BALL_RECORDED
      ↓
Kafka
      ↓
KafkaEventConsumer
      ↓
Validation
      ↓
Redis/Valkey Idempotency
      ↓
Retry Strategy
      ↓
LiveBallEventHandler

Kafka is not responsible for direct browser delivery.

Socket.IO handles frontend real-time delivery after backend event processing.

13. Kafka Connection Configuration

Kafka uses the following environment configuration:

KAFKA_CLIENT_ID
KAFKA_BROKERS
KAFKA_USERNAME
KAFKA_PASSWORD
KAFKA_CA_PATH
KAFKA_LIVE_CONSUMER_GROUP

The Kafka client uses TLS and SASL authentication.

Conceptually:

{
  clientId: process.env.KAFKA_CLIENT_ID,

  brokers,

  ssl: {
    ca: [caCertificate]
  },

  sasl: {
    mechanism: "scram-sha-256",
    username: process.env.KAFKA_USERNAME,
    password: process.env.KAFKA_PASSWORD
  }
}
14. Kafka Transport Reliability

KafkaJS uses transport-level reliability configuration:

connectionTimeout       = 10000 ms
authenticationTimeout   = 10000 ms
requestTimeout          = 30000 ms

initialRetryTime        = 300 ms
retries                 = 5
factor                  = 0.2
multiplier              = 2
maxRetryTime            = 30000 ms

These retries handle Kafka transport/client failures.

They are separate from the application-level consumer retry strategy documented in kafka-events.md.

15. Kafka Producer

The Kafka producer uses:

Partitioners.DefaultPartitioner

Domain events use:

aggregateId

as the Kafka message key.

For BALL_RECORDED:

aggregateId = matchId

The producer waits for the send operation and propagates failures instead of silently swallowing them.

16. Kafka Consumer

The live Kafka consumer uses the configured group:

KAFKA_LIVE_CONSUMER_GROUP

with the application fallback:

criczone-live-processing

The current consumer reliability model is:

At-least-once processing
        +
Redis/Valkey idempotency
        +
Application retries
        +
Dead-letter handling

CricZone does not claim exactly-once processing.

17. Kafka Dead-Letter Topic

The dead-letter topic is configured using:

KAFKA_DLQ_TOPIC

Default:

criczone.live-events.dlq

Events are moved to the DLQ path after application retries are exhausted.

See:

docs/events/kafka-events.md

for the complete event and DLQ contracts.

18. Kafka Readiness

Kafka readiness is checked using:

KafkaAdminHealthChecker

The checker performs a Kafka Admin cluster metadata operation:

describeCluster()

Kafka is considered ready when the cluster metadata operation succeeds and available brokers are reported.

19. Socket.IO

Socket.IO provides transient real-time communication between the CricZone backend and connected frontend clients.

Current match subscription model:

Client
   ↓
join-match(matchId)
   ↓
match:{matchId}
   ↓
BALL_RECORDED

Socket.IO is not the durable source of cricket state.

REST and persistent backend state are used for initial loading and reconnection synchronization.

20. Socket.IO Redis / Valkey Adapter

CricZone supports multi-instance Socket.IO communication using the Redis-compatible adapter.

                 Load Balancer
                /             \
               ↓               ↓
        CricZone A         CricZone B
        Socket.IO          Socket.IO
               \             /
                \           /
                 Redis/Valkey
              Socket.IO Adapter

Dedicated pub/sub clients are created for adapter communication.

This allows Socket.IO room events to propagate between CricZone backend instances.

21. WebSocket Dependency Structure

Business services depend on:

WebSocketGateway

rather than directly depending on Socket.IO.

Concrete implementation:

SocketIOGateway

Dependency flow:

LiveUpdateService
       ↓
WebSocketGateway
       ↓
SocketIOGateway
       ↓
Socket.IO Server

This isolates the application layer from the concrete real-time transport implementation.

22. Socket.IO CORS

The current WebSocket infrastructure contains a development origin:

http://localhost:5173

This must be changed to environment-driven CORS configuration before production deployment.

Production must not depend on the hardcoded development frontend origin.

The production WebSocket CORS configuration should use the same controlled-origin approach established for the HTTP API.

This is a known pre-deployment item for Step 23.

23. Health Endpoint

CricZone exposes:

GET /health

Successful response:

{
  "status": "UP",
  "service": "CricZone API"
}

The health endpoint indicates that the application process is running.

It is not equivalent to dependency readiness.

24. Readiness Endpoint

CricZone exposes:

GET /ready

Readiness verifies runtime dependencies.

Current dependency checks include:

PostgreSQL
    ↓
SELECT 1

Redis / Valkey
    ↓
PING

Kafka
    ↓
describeCluster()

When required dependencies are available, the application reports:

READY

When required dependencies are unavailable, the application reports:

NOT_READY

with HTTP:

503 Service Unavailable

The Kafka readiness check uses the Kafka Admin client rather than merely checking whether a producer object exists.

25. Metrics Endpoint

CricZone exposes Prometheus-compatible metrics at:

GET /metrics

The endpoint returns metrics from the application's Prometheus registry.

The response Content-Type is provided by the metrics registry.

The metrics route is mounted before /api/v1 rate limiting and therefore is not part of the public API rate-limiter path.

26. Default Metrics

CricZone collects default runtime metrics using:

collectDefaultMetrics

with prefix:

criczone_

These provide process/runtime information in addition to CricZone-specific application metrics.

27. HTTP Metrics

Current HTTP metrics include:

http_requests_total

Labels:

method
route
status

Request latency:

http_request_duration_ms

Labels:

method
route

HTTP errors:

http_errors_total

Labels:

method
route
status

The error counter is incremented for HTTP responses with status codes greater than or equal to 400.

28. Kafka Metrics

Kafka metrics include:

kafka_events_consumed_total

kafka_event_processing_duration_ms

kafka_event_failures_total

kafka_duplicate_events_total

kafka_dead_letter_events_total
29. WebSocket Metrics

WebSocket metrics include:

websocket_connected_clients

websocket_connections_total

websocket_disconnections_total

websocket_room_joins_total

websocket_room_leaves_total

websocket_invalid_subscriptions_total

websocket_emit_total

websocket_emit_failures_total

websocket_adapter_errors_total

websocket_adapter_reconnects_total

High-cardinality values such as:

socketId
matchId
room

should not be Prometheus labels.

They may be included in structured logs instead.

30. Environment Modes

CricZone supports:

development
test
production

through:

NODE_ENV

If NODE_ENV is not provided, the application defaults to:

development
31. Development Environment Variables

Required development configuration:

DATABASE_URL

REDIS_URL

KAFKA_CLIENT_ID
KAFKA_BROKERS
KAFKA_USERNAME
KAFKA_PASSWORD
KAFKA_CA_PATH
KAFKA_LIVE_CONSUMER_GROUP

CORS_ALLOWED_ORIGINS

Optional:

PORT
KAFKA_DLQ_TOPIC

DB_POOL_MAX
DB_IDLE_TIMEOUT_MS
DB_CONNECTION_TIMEOUT_MS
DB_STATEMENT_TIMEOUT_MS

Default application port:

5000
32. Test Environment Variables

Required test configuration:

TEST_DATABASE_URL

TEST_REDIS_URL

TEST_KAFKA_BROKERS
TEST_KAFKA_TOPIC
TEST_KAFKA_CA_PATH
TEST_KAFKA_USERNAME
TEST_KAFKA_PASSWORD

TEST_CORS_ALLOWED_ORIGINS

The current environment contract does not require:

TEST_KAFKA_CLIENT_ID
TEST_KAFKA_LIVE_CONSUMER_GROUP
33. Production Environment Variables

Required production configuration:

DATABASE_URL

REDIS_URL

KAFKA_CLIENT_ID
KAFKA_BROKERS
KAFKA_USERNAME
KAFKA_PASSWORD
KAFKA_CA_PATH
KAFKA_LIVE_CONSUMER_GROUP

CORS_ALLOWED_ORIGINS

Production secrets must be provided through deployment environment configuration rather than committed source files.

34. Production Security Requirements

Production infrastructure requires:

Redis/Valkey
→ TLS URL using rediss://

Kafka
→ configured brokers
→ CA certificate
→ SASL username
→ SASL password

PostgreSQL
→ SSL verification enabled

HTTP
→ controlled CORS origins
→ production security middleware

Socket.IO
→ production CORS origin must be environment-driven

Secrets such as:

DATABASE_URL
REDIS_URL
KAFKA_USERNAME
KAFKA_PASSWORD

must never be committed to Git.

35. HTTP Request Flow

The HTTP request pipeline is:

Request
   ↓
CORS
   ↓
Security Headers
   ↓
Request ID
   ↓
Request Logging
   ↓
HTTP Metrics
   ↓
JSON Parser
   ↓
/metrics or API routing
   ↓
/api/v1
   ↓
Rate Limiter
   ↓
API Router
   ↓
Controller
   ↓
Service
   ↓
Repository
   ↓
PostgreSQL / Cache
   ↓
Response

JSON request bodies are limited to:

10 KB
36. Live Event Flow

The live cricket event path is:

Cricket Event
      ↓
Kafka Producer
      ↓
Kafka Topic
      ↓
KafkaEventConsumer
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
SocketIOGateway
      ↓
Socket.IO Room
      ↓
Frontend Clients
37. Failure Flow
Kafka Event
    ↓
Processing Failure
    ↓
Application Retry
    ↓
Retries Exhausted
    ↓
Dead-Letter Topic

A WebSocket delivery failure does not replace or invalidate the durable PostgreSQL state.

Frontend clients recover current state through REST.

38. Graceful Shutdown

CricZone performs graceful infrastructure shutdown when the application terminates.

The shutdown path closes runtime resources rather than abruptly abandoning them.

This includes the relevant:

HTTP server
Kafka consumer
Kafka producer
Kafka admin client
Redis/Valkey clients
PostgreSQL pool
Socket.IO infrastructure

Kafka shutdown uses client disconnection rather than relying on consumer.stop() as the final shutdown mechanism.

39. Composition Root

Infrastructure dependencies are created and wired at the application's high-level composition boundary.

Conceptually:

server.js
    ↓
Containers
    ↓
Concrete infrastructure implementations
    ↓
ApplicationBootstrap

Examples include:

database.container.js
redis.container.js
kafka.container.js
messaging.container.js
websocket.container.js

This keeps object construction separate from business logic.

40. Runtime Responsibility Summary
PostgreSQL
→ durable source of truth

Redis / Valkey
→ cache
→ live state
→ Kafka idempotency
→ Socket.IO coordination

Kafka
→ durable asynchronous event transport

Socket.IO
→ transient real-time frontend delivery

Express
→ HTTP API

Prometheus
→ runtime/application observability

The infrastructure is designed so that persistent state, asynchronous processing, caching, real-time delivery, and observability remain separate concerns.
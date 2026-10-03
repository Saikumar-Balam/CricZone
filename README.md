# 🏏 CricZone

**CricZone** is a scalable, real-time cricket analytics platform designed to deliver live match scores, ball-by-ball updates, scorecards, commentary, player and team statistics, rankings, series information, and cricket news.

The project uses a system-design-oriented architecture with **React, Node.js, Express.js, PostgreSQL, Redis/Valkey, Apache Kafka, Socket.IO, and WebSockets**.

---

## ✨ Features

* 🏏 Live cricket scores
* ⚡ Real-time ball-by-ball match updates
* 💬 Ball-by-ball commentary
* 📊 Detailed scorecards
* 🏏 Batting and bowling statistics
* 👤 Player profiles and statistics
* 🛡️ Team information
* 🏆 Series and tournament information
* 📈 Cricket rankings
* 📊 Stats Corner
* 📰 Cricket news
* 🔎 Search
* 🌙 Dark / Light theme
* 🚀 Socket.IO-powered live updates
* ⚙️ Event-driven live event processing
* 🧩 Match-specific real-time subscriptions
* 📉 Runtime, HTTP, Kafka, and WebSocket observability

---

## 🏗️ Architecture

CricZone uses a layered, event-driven architecture.

```text
                           ┌──────────────────┐
                           │   React Client   │
                           └────────┬─────────┘
                                    │
                          REST API / Socket.IO
                                    │
                                    ▼
                           ┌──────────────────┐
                           │   Express API    │
                           └────────┬─────────┘
                                    │
                      Controller → Service → Repository
                                    │
                  ┌─────────────────┼─────────────────┐
                  │                 │                 │
                  ▼                 ▼                 ▼
             PostgreSQL       Redis / Valkey        Kafka
            Durable State     Cache / Live      Event Pipeline
                                    │                 │
                                    │                 ▼
                                    │          KafkaEventConsumer
                                    │                 │
                                    │                 ▼
                                    │          LiveBallEventHandler
                                    │                 │
                                    └────────┐        │
                                             ▼        ▼
                                          LiveUpdateService
                                                 │
                                                 ▼
                                         WebSocketGateway
                                                 │
                                                 ▼
                                           Socket.IO
                                                 │
                                                 ▼
                                          React Client
```

---

## 🔴 Live Update Pipeline

Live match updates are processed through an asynchronous event-driven pipeline.

```text
BALL_RECORDED
      │
      ▼
Apache Kafka
      │
      ▼
KafkaEventConsumer
      │
      ▼
Event Validation
      │
      ▼
Redis / Valkey Idempotency
      │
      ▼
Application Retry Strategy
      │
      ▼
LiveBallEventHandler
      │
      ▼
PostgreSQL Transaction
      │
      ├── Insert Delivery
      ├── Update Innings
      ├── Update Batting Performance
      ├── Update Bowling Performance
      ├── Handle Wicket
      ├── Update Scorecard State
      └── Store Commentary
      │
      ▼
Redis / Valkey Live Cache
      │
      ▼
LiveUpdateService
      │
      ▼
WebSocketGateway
      │
      ▼
Socket.IO
      │
      ▼
match:{matchId}
      │
      ▼
Connected Clients
```

Users watching a match subscribe only to that match's room.

```text
match:2
├── User A
├── User B
└── User C

match:8
├── User D
└── User E
```

An update for match `2` is therefore delivered only to clients subscribed to `match:2`.

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Vite
* React Router
* Tailwind CSS
* Socket.IO Client

### Backend

* Node.js
* Express.js
* REST APIs
* Socket.IO
* WebSockets

### Database

* PostgreSQL

### Cache & Coordination

* Redis / Valkey
* Live-state caching
* Kafka event idempotency
* Socket.IO cross-instance coordination

### Event Streaming

* Apache Kafka
* KafkaJS

### Testing

* Vitest
* Supertest
* PostgreSQL integration tests
* Redis/Valkey integration tests
* Kafka integration tests
* WebSocket tests

### Architecture & Engineering

* Layered Architecture
* Repository Pattern
* Dependency Injection
* Dependency Inversion
* SOLID Principles
* Event-Driven Architecture
* Transactional persistence
* Centralized error handling
* Structured logging
* Rate limiting
* API versioning
* Graceful shutdown
* Health/readiness checks
* Prometheus-compatible metrics

---

## 📁 Project Structure

```text
CricZone/
│
├── README.md
│
├── client/
│   └── ...
│
└── server/
    ├── docs/
    │   ├── api/
    │   │   └── openapi.yaml
    │   ├── events/
    │   │   ├── kafka-events.md
    │   │   └── websocket-events.md
    │   └── infrastructure/
    │       └── runtime.md
    │
    └── src/
        ├── config/
        ├── containers/
        ├── controllers/
        ├── domain/
        │   └── cricket/
        │       └── MatchFormatRules.js
        ├── handlers/
        ├── messaging/
        ├── middleware/
        ├── repositories/
        │   ├── contracts/
        │   └── postgres/
        ├── routes/
        ├── services/
        ├── websocket/
        ├── app.js
        └── server.js
```

Backend application flow:

```text
Route
  ↓
Controller
  ↓
Service
  ↓
Repository
  ↓
PostgreSQL
```

Infrastructure dependencies are assembled through dependency injection rather than being created directly inside business services.

---

## 🗄️ Core Data Model

CricZone contains cricket entities including:

* Match
* Series
* Team
* Player
* Venue
* Scorecard
* Innings
* Batting Performance
* Bowling Performance
* Delivery
* Ranking
* Statistics
* News
* Commentary

The live scorecard is composed from normalized cricket data rather than maintaining unnecessary duplicate score values.

```text
Match
  │
  ▼
Scorecard
  │
  ▼
Innings
  │
  ├── Batting Performances
  ├── Bowling Performances
  └── Deliveries
```

---

## ⚾ Ball-by-Ball Processing

A `BALL_RECORDED` Kafka event contains the information required to process a cricket delivery.

Example:

```json
{
  "eventId": "event-uuid",
  "type": "BALL_RECORDED",
  "aggregateId": "2",
  "payload": {
    "matchId": 2,
    "inningsId": 10,
    "inningsNumber": 1,
    "battingTeamId": 1,
    "bowlingTeamId": 2,
    "overNumber": 6,
    "ballNumber": 6,
    "strikerId": 17,
    "nonStrikerId": 18,
    "bowlerId": 31,
    "runs": {
      "batsman": 1,
      "extras": 0,
      "total": 1
    },
    "extras": {
      "wide": 0,
      "noBall": 0,
      "bye": 0,
      "legBye": 0,
      "penalty": 0
    },
    "boundary": {
      "four": false,
      "six": false
    },
    "wicket": {
      "occurred": false,
      "type": null,
      "dismissedPlayerId": null,
      "fielderId": null,
      "dismissalText": null
    },
    "legalDelivery": true
  }
}
```

Processing a delivery can update multiple pieces of cricket state atomically:

```text
Delivery
   │
   ├── Innings total
   ├── Wickets
   ├── Extras
   ├── Legal balls
   ├── Batter statistics
   ├── Bowler statistics
   └── Commentary
```

These related database changes are performed within a PostgreSQL transaction to prevent partial score updates.

---

## 🏏 Match Format Rules

CricZone supports format-specific cricket rules:

```text
T10
T20
ODI
TEST
HUNDRED
```

Format rules are centralized instead of being duplicated throughout scoring logic.

```js
export const MatchFormatRules = {
  T10: {
    inningsMaxBalls: 60,
    ballsPerOver: 6,
    bowlerMaxBalls: 12
  },

  T20: {
    inningsMaxBalls: 120,
    ballsPerOver: 6,
    bowlerMaxBalls: 24
  },

  ODI: {
    inningsMaxBalls: 300,
    ballsPerOver: 6,
    bowlerMaxBalls: 60
  },

  TEST: {
    inningsMaxBalls: null,
    ballsPerOver: 6,
    bowlerMaxBalls: null
  },

  HUNDRED: {
    inningsMaxBalls: 100,
    ballsPerOver: 5,
    bowlerMaxBalls: 20
  }
};
```

Legal balls are stored as canonical counters, while overs and related display values can be derived from the appropriate format rules.

---

## 🔌 WebSocket Architecture

CricZone uses Socket.IO for real-time frontend delivery.

Clients subscribe to match-specific rooms:

```text
join-match(matchId)
       │
       ▼
match:{matchId}
```

Clients unsubscribe using:

```text
leave-match(matchId)
```

The currently established backend-to-client live event is:

```text
BALL_RECORDED
```

The WebSocket payload contains the updated live state required by the frontend.

Kafka and Socket.IO have different responsibilities:

```text
Kafka
→ asynchronous backend event processing

Socket.IO
→ transient real-time delivery to connected clients
```

### Frontend synchronization

The frontend uses:

```text
REST
→ initial/current state

Socket.IO
→ incremental live updates
```

After reconnection:

```text
Socket.IO reconnect
      ↓
Fetch current state through REST
      ↓
Rejoin match room
      ↓
Continue receiving BALL_RECORDED
```

Socket.IO does not provide historical event replay.

---

## 📨 Kafka

Apache Kafka provides the asynchronous live-event pipeline.

Current live topic:

```text
criczone.live.ball-events
```

Current event:

```text
BALL_RECORDED
```

For live ball events:

```text
aggregateId = matchId
```

The aggregate ID is used as the Kafka message key.

The reliability model is:

```text
At-least-once processing
        +
Redis / Valkey event idempotency
        +
Application-level retries
        +
Dead-letter handling
```

CricZone does not claim exactly-once processing.

Default dead-letter topic:

```text
criczone.live-events.dlq
```

---

## ⚡ Redis / Valkey

Redis-compatible infrastructure is used for:

```text
Application cache
      +
Live match state
      +
Kafka event idempotency
      +
Socket.IO cross-instance coordination
```

For normal cached reads:

```text
Request
   ↓
Redis / Valkey
   ├── HIT → return cached data
   │
   └── MISS
         ↓
     PostgreSQL
         ↓
     populate cache
```

Live processing can update or invalidate relevant cached state after successful persistence.

Kafka event idempotency uses event IDs to suppress duplicate processing within the configured idempotency window.

---

## 🌐 Multi-Instance WebSocket Architecture

Socket.IO uses a Redis/Valkey adapter to support multiple CricZone backend instances.

```text
                 Load Balancer
                /             \
               ▼               ▼
        CricZone A         CricZone B
        Socket.IO          Socket.IO
               \             /
                \           /
                 Redis/Valkey
              Socket.IO Adapter
```

A room event emitted by one application instance can therefore reach clients connected to another instance.

---

## 🔒 Transactional Score Updates

A cricket delivery can modify several related pieces of persistent state.

CricZone processes those changes in one PostgreSQL transaction:

```text
BEGIN

INSERT delivery

UPDATE innings

UPDATE batting_performances

UPDATE bowling_performances

HANDLE dismissal

UPDATE scorecard state

INSERT commentary

COMMIT
```

If processing fails before completion:

```text
ROLLBACK
```

This prevents a delivery from leaving only part of the scorecard updated.

---

## ♻️ Kafka Reliability

Kafka event processing includes:

* producer acknowledgement
* stable aggregate-based partitioning
* KafkaJS transport retries
* consumer event validation
* Redis/Valkey idempotency
* application-level retries
* dead-letter handling
* Kafka readiness checking
* graceful shutdown

Application retries currently use:

```text
Initial attempt
      ↓ failure
500 ms
      ↓
Retry 1
      ↓ failure
1000 ms
      ↓
Retry 2
      ↓ failure
2000 ms
      ↓
Retry 3
```

This produces a maximum of four handler attempts.

---

## ❤️ Health & Readiness

CricZone exposes operational endpoints separately from `/api/v1`.

### Liveness

```text
GET /health
```

Example:

```json
{
  "status": "UP",
  "service": "CricZone API"
}
```

### Readiness

```text
GET /ready
```

Readiness checks:

```text
PostgreSQL
→ SELECT 1

Redis / Valkey
→ PING

Kafka
→ describeCluster()
```

An unavailable required dependency causes the application to report `NOT_READY` with HTTP `503`.

---

## 📊 Observability

Prometheus-compatible metrics are exposed at:

```text
GET /metrics
```

Metrics cover HTTP traffic, Kafka processing, WebSocket activity, and runtime behavior.

Examples:

```text
http_requests_total
http_request_duration_ms
http_errors_total

kafka_events_consumed_total
kafka_event_processing_duration_ms
kafka_event_failures_total
kafka_duplicate_events_total
kafka_dead_letter_events_total

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
```

High-cardinality identifiers such as `matchId` and `socketId` are not used as Prometheus metric labels.

---

## 🧠 Backend Design Principles

### Single Responsibility Principle

Controllers, services, repositories, messaging infrastructure, WebSocket infrastructure, and domain rules have separate responsibilities.

### Dependency Injection

Infrastructure dependencies are injected rather than instantiated throughout business logic.

### Dependency Inversion

Higher-level application logic depends on abstractions such as repository, event-producer, and WebSocket gateway contracts.

### Repository Pattern

PostgreSQL-specific persistence logic is isolated from the service layer.

### Strategy Pattern

Reliability behavior such as retry policies can be encapsulated behind dedicated strategies.

### Factory Pattern

Application/infrastructure creation is separated from request and domain processing.

### Composition Root

High-level application wiring constructs concrete infrastructure implementations and injects them into dependent components.

### Separation of Concerns

```text
PostgreSQL
→ durable state

Redis / Valkey
→ cache, live state, idempotency and Socket.IO coordination

Kafka
→ asynchronous event transport

Socket.IO
→ real-time client delivery

Prometheus
→ observability
```

---

## 🔐 Security

CricZone currently provides public cricket browsing and does not require user authentication.

Production-oriented security includes:

* HTTP security headers
* controlled CORS
* request validation
* request body limits
* rate limiting
* sanitized production errors
* structured logging
* TLS infrastructure connections
* environment-based secret management

Authentication and authorization can be introduced later if CricZone adds user-specific or privileged operations.

---

## 💻 Local Development

Clone the repository:

```bash
git clone <your-repository-url>
cd CricZone
```

### Frontend

```bash
cd client
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

The frontend and backend can run independently during development.

---

## 🌐 API

Public REST endpoints are versioned under:

```text
/api/v1
```

Resources include:

```text
/api/v1/matches
/api/v1/teams
/api/v1/players
/api/v1/series
/api/v1/venues
/api/v1/rankings
/api/v1/news
/api/v1/statistics
```

Operational endpoints are outside `/api/v1`:

```text
GET /health
GET /ready
GET /metrics
```

Development-only routes must not be exposed in production.

---

## 📚 Technical Documentation

Detailed backend contracts are maintained under:

```text
server/docs/
│
├── api/
│   └── openapi.yaml
│
├── events/
│   ├── kafka-events.md
│   └── websocket-events.md
│
└── infrastructure/
    └── runtime.md
```

### REST API Contract

```text
server/docs/api/openapi.yaml
```

Contains REST endpoints, parameters, responses, errors, and schemas.

### Kafka Event Contract

```text
server/docs/events/kafka-events.md
```

Contains event envelopes, `BALL_RECORDED`, topics, partitioning, retries, idempotency, and DLQ behavior.

### WebSocket Contract

```text
server/docs/events/websocket-events.md
```

Contains match rooms, subscription events, `BALL_RECORDED`, multi-instance delivery, and reconnect behavior.

### Runtime Infrastructure

```text
server/docs/infrastructure/runtime.md
```

Contains PostgreSQL, Redis/Valkey, Kafka, Socket.IO, health/readiness, metrics, and environment configuration.

---

## 🧪 Testing

The backend uses Vitest and Supertest with unit and integration tests covering application and infrastructure behavior.

Run the complete backend test suite from `server`:

```bash
npx vitest run
```

Kafka integration tests can be executed separately when investigating Kafka-specific behavior:

```bash
npx vitest run tests/integration/kafka --maxWorkers=1
```

---

## 🚧 Project Status

Completed backend engineering stages include:

* REST API architecture
* PostgreSQL persistence
* layered Controller → Service → Repository architecture
* Redis/Valkey caching
* Kafka producer and consumer infrastructure
* transactional live-event processing
* match-specific Socket.IO rooms
* Redis/Valkey Socket.IO adapter
* multi-instance WebSocket architecture
* Kafka retries and idempotency
* Kafka dead-letter handling
* health and readiness checks
* graceful shutdown
* security and production configuration
* HTTP/Kafka/WebSocket observability
* automated backend testing
* REST/Kafka/WebSocket/infrastructure documentation

### Current production-readiness roadmap

```text
Deployment
    ↓
CI/CD
    ↓
Load + Failure Testing
    ↓
Backend Production Ready
    ↓
Frontend API Integration
    ↓
Live Match Frontend Integration
    ↓
Dynamic Media
    ↓
Cricket Data Ingestion
    ↓
Dynamic News
    ↓
Frontend Polish
```

---

## ⚠️ Known Pre-Deployment Item

Socket.IO currently contains the development frontend origin:

```text
http://localhost:5173
```

This must be replaced with environment-driven Socket.IO CORS configuration before production deployment.

---

## 🎯 Engineering Goal

CricZone is intended to demonstrate production-oriented software engineering rather than only a static cricket UI.

The project focuses on:

* real-time systems
* event-driven architecture
* asynchronous processing
* relational data modelling
* caching
* Kafka
* WebSocket communication
* transactional consistency
* idempotent event processing
* failure recovery
* horizontal real-time scaling
* scalable backend design
* SOLID and LLD principles
* automated testing
* observability
* cloud deployment

---

## 👨‍💻 Author

**Balam Durga Sai Kumar**

Software Developer

---

## 📄 License

This project is intended for educational, portfolio, and development purposes.

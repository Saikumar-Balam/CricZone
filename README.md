# 🏏 CricZone

**CricZone** is a scalable, real-time cricket analytics platform designed to deliver live match scores, ball-by-ball updates, scorecards, commentary, player and team statistics, rankings, series information, and cricket news.

The project is built with a system-design-oriented backend architecture using **React, Node.js, Express.js, PostgreSQL, Redis, Apache Kafka, Socket.IO, and WebSockets**.

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
* 🚀 WebSocket-powered live updates
* ⚙️ Event-driven live update processing

---

## 🏗️ Architecture

CricZone uses a layered and event-driven backend architecture.

```text
                           ┌──────────────────┐
                           │   React Client   │
                           └────────┬─────────┘
                                    │
                         REST API / WebSocket
                                    │
                                    ▼
                           ┌──────────────────┐
                           │   Express API    │
                           └────────┬─────────┘
                                    │
                     Controller → Service → Repository
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
           PostgreSQL            Redis              Kafka
          Persistent DB          Cache          Event Pipeline
                                                        │
                                                        ▼
                                             Live Event Consumer
                                                        │
                                                        ▼
                                             LiveUpdateService
                                                        │
                                     ┌──────────────────┼───────────┐
                                     ▼                  ▼           ▼
                                PostgreSQL            Redis      WebSocket
                                                                  Gateway
                                                                     │
                                                                     ▼
                                                               React Client
```

---

## 🔴 Live Update Pipeline

Live match updates are processed through an event-driven pipeline.

```text
BALL_RECORDED
      │
      ▼
Apache Kafka
      │
      ▼
LiveBallEventHandler
      │
      ▼
LiveUpdateService
      │
      ▼
ScorecardRepository
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
Redis Cache Update / Invalidation
      │
      ▼
WebSocketGateway
      │
      ▼
match:<matchId>
      │
      ▼
Connected Clients
```

Users watching one match subscribe only to that match's WebSocket room.

For example:

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

### Caching

* Redis

### Event Streaming

* Apache Kafka

### Architecture & Engineering

* Layered Architecture
* Repository Pattern
* Dependency Injection
* SOLID Principles
* Event-Driven Architecture
* Transactional persistence
* Centralized error handling
* Structured logging
* Rate limiting
* API versioning

---

## 📁 Backend Structure

```text
server/
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

The backend follows:

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

The live scorecard is composed from normalized cricket data rather than maintaining duplicate score values.

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

Every `BALL_RECORDED` event contains information such as:

```json
{
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
  "boundary": {
    "four": false,
    "six": false
  },
  "wicket": {
    "occurred": false,
    "type": null,
    "dismissedPlayerId": null,
    "fielderId": null
  },
  "legalDelivery": true
}
```

Processing a delivery can update multiple aggregates atomically:

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

These operations are performed within a PostgreSQL transaction to prevent partial score updates.

---

## 🏏 Match Format Rules

CricZone supports format-specific cricket rules.

```text
T10
T20
ODI
TEST
HUNDRED
```

Format rules are centralized instead of being duplicated throughout the scoring logic.

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
}
```

Legal balls are stored as canonical counters, while overs and related display values can be derived from the appropriate format rules.

---

## 🔌 WebSocket Architecture

CricZone uses Socket.IO for real-time client delivery.

Clients join match-specific rooms:

```text
join-match
     │
     ▼
match:<matchId>
```

The backend can then broadcast:

```text
live score
wicket
boundary
commentary
over completion
milestone
match state
```

only to users interested in that match.

Kafka and WebSockets have different responsibilities:

```text
Kafka
→ asynchronous event processing

WebSocket
→ real-time delivery to connected clients
```

---

## 📨 Kafka

Apache Kafka provides the asynchronous live-event pipeline.

Example topic:

```text
LIVE_BALL_EVENTS
```

Typical flow:

```text
Producer
   ↓
Kafka Topic
   ↓
Consumer
   ↓
LiveBallEventHandler
   ↓
LiveUpdateService
```

This separates event ingestion from live-score processing and client delivery.

---

## ⚡ Redis

Redis is used for caching frequently accessed live and read-heavy data.

The intended flow is:

```text
Request
   ↓
Redis
 ├── HIT  → return cached data
 │
 └── MISS
       ↓
   PostgreSQL
       ↓
   populate cache
```

Live score updates can invalidate or refresh relevant cached state after successful persistence.

---

## 🔒 Transactional Score Updates

A ball can modify several pieces of cricket state.

CricZone processes those related database changes in one transaction:

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

This prevents a delivery from updating only part of the scorecard.

---

## 🧠 Backend Design Principles

The backend is designed around several software engineering principles.

**Single Responsibility Principle**

Controllers, services, repositories, messaging infrastructure, WebSocket infrastructure, and domain rules have separate responsibilities.

**Dependency Injection**

Infrastructure dependencies are injected rather than instantiated throughout business logic.

**Dependency Inversion**

Higher-level application logic depends on abstractions such as repository and event-producer contracts.

**Repository Pattern**

PostgreSQL-specific persistence logic is isolated from the service layer.

**Separation of Concerns**

Kafka handles asynchronous event transport, PostgreSQL handles persistent state, Redis handles caching, and WebSockets handle real-time client communication.

---

## 🚧 Project Status

CricZone is currently under active development.

Completed / in progress areas include:

* Frontend page structure
* REST API design
* PostgreSQL schema
* Repository / Service / Controller architecture
* Redis infrastructure
* Kafka producer and consumer infrastructure
* WebSocket infrastructure
* Match-specific WebSocket rooms
* Live ball event processing
* Transactional scorecard updates
* Batting and bowling live updates
* Wicket processing
* Ball-by-ball commentary pipeline
* Cache synchronization
* Observability and deployment

---

## 🎯 Planned Improvements

* Complete live score pipeline
* Rich ball-by-ball commentary
* Commentary filters for wickets, fours, sixes, overs, and milestones
* Live scorecard synchronization
* Dynamic cricket news
* Dynamic player and team images
* Improved Redis caching
* Duplicate-event/idempotency protection
* Failure recovery
* Metrics and distributed tracing
* End-to-end live update testing
* Cloud deployment

---

## 💻 Local Development

Clone the repository:

```bash
git clone <your-repository-url>
cd CricZone
```

Install frontend dependencies:

```bash
cd client
npm install
npm run dev
```

Install backend dependencies:

```bash
cd server
npm install
npm run dev
```

The frontend and backend can then run independently during local development.

---

## 🌐 API

The backend follows versioned REST API routes:

```text
/api/v1/...
```

Example development health check:

```text
GET /api/v1/health
```

Development-only Kafka/WebSocket test routes should not be exposed in production.

---

## 📌 Engineering Goal

CricZone is not intended to be only a static cricket UI.

The goal is to build a production-oriented cricket platform demonstrating:

* real-time systems
* event-driven architecture
* asynchronous processing
* relational data modelling
* caching
* WebSocket communication
* transactional consistency
* scalable backend design
* SOLID and LLD principles
* observability
* cloud deployment

---

## 👨‍💻 Author

**Balam Durga Sai Kumar**

Software Developer | Backend & Full-Stack Development

---

## 📄 License

This project is intended for educational, portfolio, and development purposes.

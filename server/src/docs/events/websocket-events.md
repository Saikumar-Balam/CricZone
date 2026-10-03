CricZone WebSocket Event Contract
1. Purpose

This document defines the Socket.IO event contract used by CricZone for real-time cricket updates.

The current live-update flow is:

Kafka Event
    ↓
KafkaEventConsumer
    ↓
LiveBallEventHandler
    ↓
LiveUpdateService
    ↓
WebSocketGateway
    ↓
SocketIOGateway
    ↓
Socket.IO Server
    ↓
match:{matchId}
    ↓
Connected Clients

Kafka and Socket.IO have different responsibilities.

Kafka
→ asynchronous backend event processing

Socket.IO
→ real-time delivery to connected frontend clients
2. Connection Model

Frontend clients establish a Socket.IO connection to the CricZone backend.

After connecting, a client subscribes only to the matches it wants to receive live updates for.

CricZone does not maintain a custom global socket subscription registry.

Socket.IO rooms provide subscription management.

3. Match Rooms

Each match has a dedicated Socket.IO room.

Room naming convention:

match:{matchId}

Example:

match:123

Room names are generated centrally through:

WebSocketRooms.match(matchId)

Conceptually:

static match(matchId) {
  return `match:${matchId}`;
}

This prevents room-name construction from being duplicated throughout the application.

4. Client → Server Events

The current client subscription contract supports:

join-match
leave-match
4.1 join-match

Used when a frontend client wants to receive live updates for a match.

Event
join-match
Payload

The payload is the match ID directly.

socket.emit("join-match", matchId);

Example:

socket.emit("join-match", "123");

The payload is not currently an object such as:

{
  matchId: "123"
}
Validation

The backend requires the match ID to be:

string
+
non-empty after trimming

Valid:

"123"

Invalid examples:

""
"   "
null
undefined
123

When valid, the socket joins:

match:{matchId}
4.2 leave-match

Used when the frontend no longer needs live updates for a match.

Event
leave-match
Payload
socket.emit("leave-match", matchId);

Example:

socket.emit("leave-match", "123");

The same match ID validation rules apply.

When valid, the socket leaves:

match:{matchId}
5. Subscription Acknowledgement

The current subscription contract does not define an acknowledgement callback.

Therefore:

socket.emit("join-match", matchId);

does not currently return a formal:

success
error
subscription acknowledgement

response to the frontend.

Likewise, invalid subscription payloads do not currently define a dedicated client-facing Socket.IO error event.

Invalid subscriptions are rejected at the server boundary and are observable through backend logging and metrics.

6. Server → Client Events

The currently established live event delivered to frontend clients is:

BALL_RECORDED

It is emitted only to clients subscribed to the relevant match room.

Conceptually:

Kafka BALL_RECORDED
        ↓
Backend processing
        ↓
Updated live state
        ↓
BALL_RECORDED
        ↓
match:{matchId}
7. BALL_RECORDED

BALL_RECORDED informs connected clients that the current live match state has changed after processing a delivery.

The WebSocket payload represents frontend live state.

It is intentionally different from the richer Kafka BALL_RECORDED domain-event payload.

Payload
{
  "matchId": "match-id",
  "inningsId": "innings-id",
  "inningsNumber": 1,

  "score": {
    "runs": 100,
    "wickets": 3,
    "legalBalls": 75,
    "extras": 5
  },

  "lastDelivery": {
    "deliveryId": "delivery-id",
    "overNumber": 12,
    "ballNumber": 4,
    "batsmanRuns": 4,
    "extraRuns": 0,
    "totalRuns": 4,
    "wicket": false,
    "four": true,
    "six": false
  },

  "inningsCompleted": false,
  "completionReason": null,
  "updatedAt": "ISO-8601 timestamp"
}
8. Live-State Schema
Match state
matchId
inningsId
inningsNumber
score
lastDelivery
inningsCompleted
completionReason
updatedAt
Score
score
├── runs
├── wickets
├── legalBalls
└── extras
Last delivery
lastDelivery
├── deliveryId
├── overNumber
├── ballNumber
├── batsmanRuns
├── extraRuns
├── totalRuns
├── wicket
├── four
└── six

The frontend should treat this payload as the latest incremental live-state update resulting from the processed delivery.

9. REST + WebSocket State Model

CricZone does not rely on Socket.IO as the permanent source of match state.

The frontend uses:

REST
→ initial/current state

Socket.IO
→ incremental live updates

Typical flow:

Open Match Page
      ↓
GET current match/scorecard using REST
      ↓
Connect Socket.IO
      ↓
join-match(matchId)
      ↓
Receive BALL_RECORDED updates
      ↓
Update frontend state

This prevents the frontend from depending on historical WebSocket events to reconstruct the current scorecard.

10. Reconnection and Resynchronization

Socket.IO delivery is transient.

CricZone does not currently provide event replay through the WebSocket layer.

Therefore, after a connection loss, the frontend should resynchronize using REST.

Recommended reconnection flow:

Connection Lost
      ↓
Socket.IO reconnects
      ↓
Fetch current match/scorecard using REST
      ↓
Replace/resynchronize frontend state
      ↓
join-match(matchId)
      ↓
Continue receiving BALL_RECORDED events

This ensures updates missed while disconnected do not leave the frontend with stale state.

11. Multi-Instance Architecture

CricZone supports multiple backend instances through the Socket.IO Redis/Valkey adapter.

                 Load Balancer
                /             \
               ↓               ↓
        CricZone A         CricZone B
        Socket.IO          Socket.IO
               \             /
                \           /
                 Redis/Valkey
              Socket.IO Adapter

A client connected to one backend instance can receive a room event emitted through another instance because Socket.IO coordinates room broadcasts through Redis/Valkey pub/sub.

12. Redis/Valkey Adapter

Socket.IO uses dedicated Redis/Valkey pub/sub clients for adapter communication.

These clients are separate from the conceptual responsibility of the normal application cache.

Redis/Valkey therefore serves multiple infrastructure responsibilities in CricZone:

Redis/Valkey
├── application/live cache
├── Kafka event idempotency
└── Socket.IO cross-instance coordination

These responsibilities use the same Redis-compatible infrastructure but remain logically separate.

13. Cross-Instance Broadcasting

Business services do not depend directly on the Socket.IO implementation.

The application uses:

WebSocketGateway

with the concrete implementation:

SocketIOGateway

The live-update path is:

LiveUpdateService
      ↓
WebSocketGateway
      ↓
SocketIOGateway
      ↓
Socket.IO
      ↓
Redis/Valkey Adapter
      ↓
match:{matchId}

The application does not need to know which backend instance owns an individual client connection.

14. Connection Lifecycle

The Socket.IO connection handler is responsible for connection-boundary behavior.

Conceptually:

Client Connects
      ↓
SocketConnectionHandler
      ↓
Register join-match
Register leave-match
Register disconnect

Room membership belongs to Socket.IO rather than being duplicated in a custom application-level subscription registry.

When a socket disconnects, Socket.IO removes that socket from its rooms.

15. Failure Handling

WebSocket delivery failures should not invalidate the durable cricket state.

The responsibility hierarchy is:

PostgreSQL
→ durable source of truth

Redis/Valkey
→ current cached/live state and coordination

Kafka
→ asynchronous event transport

Socket.IO
→ transient client delivery

A WebSocket delivery problem therefore does not replace or roll back durable backend state.

Clients can recover current state through REST.

16. WebSocket Observability

CricZone exposes the following WebSocket metrics:

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

These metrics provide visibility into:

current connected clients
connection lifecycle
room subscriptions
invalid subscription attempts
outbound event delivery
emission failures
Redis/Valkey adapter failures
adapter reconnections
17. Metric Cardinality

High-cardinality identifiers must not be used as Prometheus metric labels.

Avoid labels such as:

socketId
matchId
room

For example, avoid:

websocket_emit_total{matchId="123"}

because a large number of matches could create an unbounded number of Prometheus time series.

Identifiers such as:

socketId
matchId
room

may instead be included in structured logs when needed for debugging.

18. Current Limitations

The current WebSocket contract intentionally has the following limitations:

No WebSocket event replay.
No persistent client event history.
No acknowledgement contract for join-match.
No acknowledgement contract for leave-match.
No dedicated client-facing invalid-subscription error event.
Only the currently established BALL_RECORDED outbound live-event contract is documented.

REST resynchronization handles missed live updates after reconnection.

19. Frontend Integration Contract

The frontend integration planned for CricZone follows:

REST
├── match information
├── scorecard/current state
└── reconnection resynchronization

Socket.IO
├── join-match
├── leave-match
└── BALL_RECORDED

The frontend should not assume Socket.IO contains the complete historical state of a match.

20. WebSocket Contract Summary
Client
  │
  ├── join-match(matchId)
  │
  └── leave-match(matchId)
  │
  ↓
Socket.IO Server
  │
  ↓
match:{matchId}
  │
  ↑
BALL_RECORDED
  │
LiveUpdateService
  │
  ↑
Processed Kafka Event

The design keeps backend event processing and frontend real-time delivery separate:

Kafka
→ reliable asynchronous backend processing

PostgreSQL
→ durable state

Redis/Valkey
→ cache + coordination

Socket.IO
→ transient real-time frontend delivery

REST
→ current-state retrieval and resynchronization
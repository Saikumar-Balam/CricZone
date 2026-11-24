# Phase 25.8.6 — WebSocket Scalability Analysis

**Project:** CricZone  
**Branch:** `feat/rest-api-baseline-25-8-1`  
**Environment:** Isolated GitHub Actions runner (`ubuntu-24.04`), single backend, Socket.IO over WebSocket, Redis adapter  
**Evidence date:** 2026-11-24 12:46:09.656 UTC (connection lifecycle test)  
**Report status:** **PARTIAL — live-event delivery and reconnection benchmark awaiting CI evidence**

## 1. Purpose and scope

Measure Socket.IO connection establishment, room subscription and disconnection under 10, 25 and 50 sequential client cohorts. Follow up with an end-to-end `BALL_RECORDED` delivery test traversing Kafka, PostgreSQL, `LiveUpdateService`, and Socket.IO, including explicit disconnect/reconnect/rejoin scenarios.

This is an isolated CI test, **not** a production capacity or availability certification.

## 2. System under test

- Server: `server/src/bootstrap/ApplicationBootstrap.js` creates the HTTP server and Socket.IO infrastructure.
- Socket.IO construction and Redis adapter: `server/src/containers/websocket.container.js`.
- Room lifecycle: `server/src/websocket/SocketConnectionHandler.js` handles `join-match`, `leave-match`, and `disconnect`.
- Room name: `match:<id>` from `server/src/websocket/WebSocketRooms.js`.
- Live event path: Kafka `criczone.live.ball-events` → `KafkaEventConsumer` → `LiveBallEventHandler` → `LiveUpdateService.processBallRecorded` → `SocketIOGateway.emitToRoom` → `BALL_RECORDED`.
- Metrics: `/metrics` with Socket.IO connection, join, leave and disconnect counters.

## 3. Completed connection and lifecycle benchmark

Source: user-provided `25.8.6` JSON at `2026-11-24T12:46:09.656Z`.

| Metric | 10 clients | 25 clients | 50 clients |
|---|---:|---:|---:|
| Connection attempts | 10 | 25 | 50 |
| Successful connections | 10 | 25 | 50 |
| Failed connections | 0 | 0 | 0 |
| Average connection latency (ms) | 24.8545 | 15.3193 | 21.3714 |
| Median connection latency (ms) | 23.8759 | 15.1508 | 19.8183 |
| p95 connection latency (ms) | 33.0523 | 15.7457 | 23.8441 |
| p99 connection latency (ms) | 33.0523 | 19.9177 | 29.3243 |
| Maximum connection latency (ms) | 33.0523 | 19.9177 | 29.3243 |
| Verified room joins | 10 | 25 | 50 |
| Verified room leaves | 10 | 25 | 50 |
| Verified disconnects | 10 | 25 | 50 |
| Active-client gauge sample | 10 | 25 | 50 |

**Observed totals:** 85/85 successful connections, 85 joins, 85 leaves and 85 disconnects; no reported errors. The cohorts were sequential; the sum of 85 does not mean 85 simultaneous clients. Maximum tested concurrency was 50.

### Interpretation

The measured single backend accepted up to 50 simultaneous WebSocket connections in these brief trials, with a 50-client connection p95 of 23.8441 ms. The apparently faster 25-client cohort is not evidence of improved scaling; each cohort represents a short sample on a variable CI runner. The initial disconnect verification error was caused by the benchmark's failure to aggregate labeled Prometheus counter samples; the corrected run verified the full disconnect counts.

## 4. Phase 25.8.6.5 — Live-event delivery and reconnection

**Status: NOT YET MEASURED.** The completed connection-lifecycle JSON explicitly states that it did not test `BALL_RECORDED` delivery or reconnect recovery. Do not fill in outcome values until a successful dedicated workflow run is available.

### Test implementation

`server/scripts/profile-websocket-delivery.mjs` is intended to run after the connection lifecycle step. It:

1. Enforces isolated CI environment, localhost broker/backend and the seeded `criczone_test` database.
2. Verifies clean seeded innings, batting/bowling rows and no previously inserted deliveries.
3. Establishes 10, 25 and 50 actual Socket.IO clients, joining `match:1` and verifying the server join counter.
4. Publishes one valid, uniquely identified `BALL_RECORDED` message for each cohort to the actual Kafka live topic.
5. Waits for all subscribed clients to receive the matching ball number, rejects duplicate notifications, and checks exactly one matching PostgreSQL `deliveries` row.
6. Explicitly disconnects about 20% of the clients, reconnects them, verifies their resubscriptions, and publishes a second unique event to all clients.
7. Records per-client publish-to-receipt latency and writes `server/benchmark-evidence/websocket-delivery-profile.json` even if the benchmark detects a failure.

### Acceptance criteria

- Every subscribed client in every cohort receives the expected event exactly once.
- Six distinct events are each persisted once in the CI database.
- Reconnected clients receive the second event after rejoining the room.
- All event checks complete within the test deadline; no missing/duplicate notifications.
- JSON report has `status: "passed"` with cohort-level latency and counts.

### Evidence to fill after CI run

| Evidence | Result |
|---|---|
| Delivery/reconnect workflow run ID | Pending |
| Event count | Pending (planned: 6) |
| Total expected client deliveries | Pending (planned: 170) |
| Missing notifications | Pending |
| Duplicate notifications | Pending |
| Delivery p50/p95/p99 by cohort | Pending |
| Reconnected client count and success | Pending |
| DB persistence integrity | Pending |

### Restrictions

The test uses sequential, short bursts against one backend and one Redis/Kafka instance. It is not a steady-state soak test, scale-out test, Redis-adapter failover test or automatic Socket.IO retry/backoff test. Reported message latency is the **end-to-end publish-to-client** latency, including asynchronous Kafka, PostgreSQL and Redis work, not isolated Socket.IO network latency.

## 5. Conclusions and optimization decision

**Supported now:** Connection and room lifecycle passed across three isolated client cohorts, reaching 50 simultaneous clients without connection errors. There is no observed connection-lifecycle bottleneck in this limited test.

**Not yet supported:** Claims about real cricket event fan-out, reconnect recovery, production-scale concurrent connections, failover or sustained throughput.

**Decision:** Do not modify production Socket.IO configuration based on these brief connection tests. Complete and review the dedicated event-delivery JSON, then update this report with measured results. Keep this phase **PARTIAL** until that evidence is available.

## 6. Reproduction and evidence paths

- `server/scripts/profile-websocket.mjs`
- `server/benchmark-evidence/websocket-profile.json`
- `server/scripts/profile-websocket-delivery.mjs`
- `server/benchmark-evidence/websocket-delivery-profile.json` (pending CI run)
- `.github/workflows/rest-api-baseline.yml`

All measurements and conclusions apply only to the specified isolated GitHub Actions benchmark conditions.

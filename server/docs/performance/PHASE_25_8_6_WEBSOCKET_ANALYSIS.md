# Phase 25.8.6 — WebSocket Scalability Analysis

**Project:** CricZone  
**Branch:** `feat/rest-api-baseline-25-8-1`  
**Environment:** Isolated GitHub Actions runner (`ubuntu-24.04`); one CricZone backend, local Kafka, PostgreSQL and Redis; Socket.IO over the WebSocket transport  
**Connection evidence:** `2026-11-24T12:46:09.656Z`  
**End-to-end delivery evidence:** `2026-11-24T14:23:24.149Z`  
**Report status:** **COMPLETE — all planned Phase 25.8.6 CI checks passed within the tested scope**

## 1. Objective and system under test

Verify WebSocket connection establishment, room membership, disconnection, real cricket-event fan-out and explicit reconnection under sequential cohorts of 10, 25 and 50 clients. The delivery test follows the real application path:

`Kafka criczone.live.ball-events` → `KafkaEventConsumer` → `LiveBallEventHandler` → `LiveUpdateService.processBallRecorded` → PostgreSQL delivery persistence / Redis cache updates → `SocketIOGateway.emitToRoom("match:1", "BALL_RECORDED", ...)` → subscribed Socket.IO clients.

The backend is assembled by `server/src/bootstrap/ApplicationBootstrap.js`; Socket.IO and its Redis adapter are created in `server/src/containers/websocket.container.js`; room lifecycle events `join-match` / `leave-match` are handled in `server/src/websocket/SocketConnectionHandler.js`. The benchmark runs only against the isolated localhost CI environment and the `criczone_test` database.

## 2. Connection and room lifecycle results (Phase 25.8.6)

Source: `server/benchmark-evidence/websocket-profile.json`, recorded `2026-11-24T12:46:09.656Z`.

| Metric | 10 clients | 25 clients | 50 clients |
|---|---:|---:|---:|
| Connection attempts | 10 | 25 | 50 |
| Successful connections | 10 | 25 | 50 |
| Failed connections | 0 | 0 | 0 |
| Average connection latency (ms) | 24.855 | 15.319 | 21.371 |
| Median connection latency (ms) | 23.876 | 15.151 | 19.818 |
| p95 connection latency (ms) | 33.052 | 15.746 | 23.844 |
| p99 connection latency (ms) | 33.052 | 19.918 | 29.324 |
| Match-room joins verified | 10 | 25 | 50 |
| Match-room leaves verified | 10 | 25 | 50 |
| Disconnections verified | 10 | 25 | 50 |
| Active-client gauge sample | 10 | 25 | 50 |

**Result:** 85/85 connection attempts succeeded; all 85 room joins, 85 room leaves and 85 disconnections were verified through backend metrics. The maximum simultaneous client count was **50**, not 85; cohorts ran sequentially. The earlier zero-disconnection result was a benchmark parser problem: `websocket_disconnections_total` has a `reason` label and needed labeled-series aggregation. The corrected benchmark passed.

## 3. Live cricket-event delivery and reconnection (Phase 25.8.6.5)

Source: `server/benchmark-evidence/websocket-delivery-profile.json`, recorded `2026-11-24T14:23:24.149Z` with `status: "passed"`.

Each cohort connected and subscribed to `match:1`, received an initial real `BALL_RECORDED` event, explicitly disconnected/reconnected approximately 20% of its clients, resubscribed those clients, and received a second unique event. Each event went through Kafka and the application pipeline and was checked for a corresponding unique row in PostgreSQL `deliveries`.

| Metric | 10 clients | 25 clients | 50 clients | Total |
|---|---:|---:|---:|---:|
| Distinct Kafka live events | 2 | 2 | 2 | **6** |
| Initial broadcast notifications | 10 | 25 | 50 | 85 |
| Post-reconnect notifications | 10 | 25 | 50 | 85 |
| Client notifications verified | 20 | 50 | 100 | **170** |
| Missing notifications | 0 | 0 | 0 | **0** |
| Duplicate notifications | 0 | 0 | 0 | **0** |
| Explicitly reconnected clients | 2 | 5 | 10 | **17** |
| Deliveries persisted once per event ID | 2 | 2 | 2 | **6** |

### 3.1 Publish-to-client latency

Latencies are recorded from Kafka producer publish initiation to Socket.IO receipt at each benchmark client. These measurements **include Kafka, application processing, PostgreSQL, Redis and Socket.IO**, and therefore are not pure WebSocket transport latency.

| Cohort and broadcast | Average (ms) | p50 (ms) | p95 (ms) | p99 (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|
| 10 initial | 44.974 | 44.960 | 45.295 | 45.295 | 45.295 |
| 10 after reconnection | 12.418 | 12.414 | 12.662 | 12.662 | 12.662 |
| 25 initial | 14.290 | 14.246 | 14.800 | 14.850 | 14.850 |
| 25 after reconnection | 12.817 | 12.826 | 13.128 | 13.151 | 13.151 |
| 50 initial | 16.400 | 16.291 | 17.302 | 17.368 | 17.368 |
| 50 after reconnection | 16.076 | 16.052 | 17.359 | 17.414 | 17.414 |

The highest measured publish-to-client latency across all six events was **45.295 ms** (first 10-client broadcast). The maximum at 50 clients was **17.414 ms**. These brief trials do not establish steady-state latency percentiles or a latency-versus-concurrency trend.

### 3.2 Explicit reconnection

| Cohort | Reconnected clients | Reconnect and resubscribe duration (ms) | Subsequent event delivery |
|---|---:|---:|---|
| 10 clients | 2 | 15.796 | 10/10 clients |
| 25 clients | 5 | 18.109 | 25/25 clients |
| 50 clients | 10 | 23.893 | 50/50 clients |

**Result:** all **17** explicitly reconnected clients received the next event after resubscribing, alongside their continuously connected peers. The duration metric covers the benchmark's client replacement and resubscription sequence; it is **not** an automatic reconnect/backoff recovery time and does not measure Redis-adapter failover.

### 3.3 Event persistence and integrity

The test produced six distinct `BALL_RECORDED` messages with unique event UUIDs. For each published event, the test checked exactly one PostgreSQL `deliveries` row by `event_id`, while clients recorded zero missing and zero duplicate matching notifications. This is **observed integrity for the six tested events**, not a general exactly-once delivery guarantee under arbitrary failures or network partitions.

## 4. Acceptance assessment

| Test criterion | Evidence | Outcome |
|---|---|---|
| 10/25/50 concurrent connection cohorts | 85/85 accepted | PASS |
| Room join / leave / disconnect lifecycle | 85 of each, metric verified | PASS |
| Each real live-ball event reaches all subscribers | 170/170 notifications | PASS |
| No duplicate or missing client notifications | 0 / 0 reported | PASS |
| One database delivery per event ID | 6/6 checked | PASS |
| Explicit reconnect / resubscribe and subsequent delivery | 17 clients reconnected; subsequent events received | PASS |
| Record per-client end-to-end delivery latency | Six latency distributions included | PASS |

**Phase 25.8.6 conclusion:** Planned isolated CI functional and short-burst scalability verification **passed**. No connection failure, delivery loss, duplicate, or failed explicit reconnection was observed in the tested workloads.

## 5. Limitations and interpretation

1. **Single backend instance:** no multi-instance socket fan-out or Redis adapter cross-instance coordination was exercised.
2. **Short, sequential cohorts:** 10, 25 and 50 clients were tested separately; 50 was the maximum simultaneous connection count. This is not a maximum-capacity or soak benchmark.
3. **Local dependencies on GitHub Actions:** Kafka, Redis, PostgreSQL and the backend shared an isolated CI environment; cloud deployment network and resource characteristics were not measured.
4. **Explicit reconnect only:** benchmark-controlled disconnect/reconnect/rejoin is not evidence for automatic reconnect, retry/backoff behavior, or recovery from unplanned drops.
5. **No fault injection:** Kafka failures, Redis adapter outages, broker recovery, backend restarts and network partitions were not tested.
6. **Small number of distinct live events:** six published balls exercised the full path, but do not establish sustained event rates, high-volume throughput, or generalized exactly-once semantics.
7. **Client-side receipt measurements:** no end-user browser rendering latency or geographically distributed client performance was captured.

## 6. Optimization and next action

**Decision:** No Socket.IO performance optimization is currently justified by these observations. Preserve existing behavior rather than changing rooms, connection options or Redis adapter settings without evidence of a bottleneck.

Mark Phase **25.8.6 complete for its planned isolated CI scope**. Proceed to **Phase 25.8.7: Performance Optimization and Bottleneck Remediation**, starting with evidence-based prioritization of findings from REST, PostgreSQL, Redis, Kafka and Socket.IO. Treat higher concurrency, sustained-load, multi-instance and failure-injection scenarios as additional validation work if production scale requires it.

## 7. Reproduction and evidence

- CI workflow: `.github/workflows/rest-api-baseline.yml` (capacity profile)
- Connection benchmark: `server/scripts/profile-websocket.mjs`
- Connection evidence: `server/benchmark-evidence/websocket-profile.json`
- Live event benchmark: `server/scripts/profile-websocket-delivery.mjs`
- Live event evidence: `server/benchmark-evidence/websocket-delivery-profile.json`
- Live event Kafka topic: `criczone.live.ball-events`
- Verified match room: `match:1`

*Results are supported by the two submitted CI JSON reports. No production-scale capacity, automatic recovery, or cross-instance behavior is claimed.*

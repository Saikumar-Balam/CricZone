# CricZone — Phase 25.8.7: Evidence-Backed Optimization Decisions

**Date:** 2026-11-24  
**Repository:** `Saikumar-Balam/CricZone`  
**Branch reviewed:** `feat/rest-api-baseline-25-8-1`  
**Environment:** Isolated GitHub Actions runner (ubuntu-24.04), locally hosted PostgreSQL, Redis, Kafka and one Node.js backend  
**Decision:** No performance-tuning change accepted for the tested CI workloads. Proceed to Phase 25.8.8 as a repeatability/verification benchmark, not a claimed before–after speedup.

## 1. Scope and evidence

This decision reviews Phase 25.8.1 through 25.8.6 user-provided benchmark reports and the repository implementation. The numbers characterize the configured CI workload, **not production load capacity**.

| Phase | Observed evidence | Assessment |
|---|---|---|
| 25.8.1 REST capacity | 1,481 requests; 49.03 requests/s; 0 HTTP errors; 0 HTTP 429; overall p95 3.53 ms at 10 VUs | No demonstrated REST bottleneck |
| 25.8.2 REST isolated endpoints | 15,632 total requests across six 30-second scenarios; 0 failures; 25-VU endpoint p95 3.39 ms (matches), 4.08 ms (detail), 3.30 ms (scorecard) | No demonstrated endpoint bottleneck; scripted pacing prevents treating these as maximum throughput |
| 25.8.3 PostgreSQL | Small seeded dataset; slowest sampled SQL plan approximately 0.119 ms; 200 connection samples, maximum 10 observed connections, maximum 2 active | No confirmed SQL/index or pool saturation. Tiny tables make sequential scans reasonable; app-level pool waiting was not measured |
| 25.8.4 Redis | GET hit p95 0.401 ms; GET miss p95 0.157 ms; SET p95 0.305 ms; DEL p95 0.163 ms (100 commands each); cache populated, TTL 60s, cold/warm response equality verified | No Redis command bottleneck shown. Single cold/warm HTTP sample (32.26 ms/4.41 ms) cannot support a stable speedup claim |
| 25.8.5 Kafka | 1,000 produced and consumed; producer 12,424 messages/s during ~80 ms burst; zero missing/duplicate messages, zero final committed lag; delivery p95 38 ms | Short single-partition broker + dedicated consumer benchmark passed; cannot generalize to sustained throughput or the application consumer |
| 25.8.6 Socket.IO | 85/85 successful connections at sequential 10/25/50 cohorts; 85 joins, leaves and disconnects verified; 50-client connection p95 23.84 ms | Connection/room lifecycle passed; not a production concurrency ceiling |
| 25.8.6.5 Live fan-out | 6 unique persisted ball events; 170/170 client notifications; zero missing/duplicate deliveries; 17 explicitly reconnected clients received next event; 50-client delivery p95 17.30 ms initial and 17.36 ms post-reconnect | Functional end-to-end test passed on one app instance; no sustained fan-out, automatic reconnection or cross-instance failover test |

## 2. Source-code audit and decisions

### 2.1 REST API and rate limiting — retain current behavior

**Reviewed:** `server/src/containers/Infrastructure.container.js`, `server/src/rate-limiting/InMemoryRateLimiter.js`, `server/src/middleware/RateLimiterMiddleware.js`.

- Normal test/nonproduction configuration uses a 100-request/60-second in-memory limiter; the isolated `capacity` profile intentionally raises this to 10,000 requests/60 seconds. Production selects `RedisRateLimiter`.
- Earlier stress-test 429 responses should be interpreted as rate limiting under the normal profile, not as a demonstrated service throughput limit.
- **Decision R1:** Do not raise production rate limits, disable protection, or claim rate-limiter behavior is an application latency bottleneck.
- **Follow-up risk R1a:** The in-memory limiter retains a `Map` of client keys with no visible expiry sweep. This could grow with many unique client IPs in long-running nonproduction processes. Characterize memory growth under a controlled workload before proposing cleanup/eviction code. Not proven material in the CI run.

### 2.2 PostgreSQL — no speculative indexing or pool expansion

**Reviewed:** `server/src/database/postgres/PostgresDatabaseClient.js`, `server/src/repositories/postgres/PostgresCacheInvalidationRepository.js` and recorded SQL plans.

- PostgreSQL connection pool configuration is injected; SQL statement timeouts are enforced per new pool connection.
- `hasPendingInvalidation(matchId)` checks outbox rows with status other than `COMPLETED` and maintains the service's consistency path.
- **Decision P1:** Do not add indexes to tiny CI tables based only on sequential scans. Do not increase pool size without observed app-level queueing.
- **Next evidence:** realistic table cardinalities, `EXPLAIN (ANALYZE, BUFFERS)` under larger data, `pg.Pool.waitingCount`, and request latency during concurrent mixed operations.

### 2.3 Redis cache — prioritize consistency over a speculative hit-path speedup

**Reviewed:** `server/src/services/MatchService.js`, `server/src/cache/RedisCache.js`, `server/src/cache/CacheTTL.js`.

- Match cache uses a 60-second TTL. Before using cached match data, the service queries PostgreSQL for pending invalidations and rechecks after a Redis cache hit.
- A warm Redis hit therefore **does not imply zero PostgreSQL queries**.
- **Decision C1:** Do not remove either invalidation check to chase cache latency. Do not lengthen TTLs or switch eviction policy on the basis of the small CI run.
- **Follow-up risk C1a:** Cache/invalidation correctness under concurrent mutation and read was not measured; test before changing the read path.
- Redis reported `maxmemory=0` and `noeviction` in isolated CI. Review memory limits against deployment requirements separately; this is not evidence of CI memory pressure.

### 2.4 Kafka — keep current configuration

**Reviewed:** `server/src/messaging/KafkaEventConsumer.js`, `server/src/containers/kafka.container.js`, `server/src/services/LiveUpdateService.js`.

- The app consumer includes an idempotency claim, retry strategy and dead-letter handling. The Phase 25.8.5 throughput figure came from a **separate synthetic consumer**.
- The live-delivery test establishes functional end-to-end delivery for six events, not sustained live-event processing rate.
- **Decision K1:** Do not change partition count, acknowledgment policy, retry count or consumer concurrency based on the short single-partition test.
- **Follow-up risk K1a:** Test sustained input rates, backlog recovery, DLQ failure behavior and broker restarts before production scaling claims.

### 2.5 WebSocket — retain adapter and room behavior

**Reviewed:** `server/src/containers/websocket.container.js`, `server/src/websocket/SocketConnectionHandler.js`, `server/src/websocket/SocketIOGateway.js`.

- Socket.IO uses the Redis adapter and per-match subscriptions (`join-match` / `leave-match`). Metrics count connections and room operations.
- The 10/25/50 cohorts succeeded; live Kafka-to-Socket.IO events reached all subscribed clients after explicit reconnects.
- **Decision W1:** Do not add or alter transport tuning, socket limits or adapter topology without larger/sustained tests.
- **Follow-up risk W1a:** `SocketIOGateway.emitToRoom` confirms local enqueue/emit invocation, not remote delivery; app persistence can succeed before client reception. This is a reliability/observability distinction. Client delivery was verified in the separate test, but a disconnected client's backfill/recovery behavior was not.

## 3. Accepted and rejected change ledger

| ID | Candidate | Decision | Justification |
|---|---|---|---|
| R1 | Raise production REST rate limit | Rejected | 429 indicates configured protection, not proven saturation |
| P1 | Add PostgreSQL indexes / increase pool | Deferred | Seed too small; no pool queue measurements |
| C1 | Remove PostgreSQL invalidation checks on Redis hit | Rejected | Violates established cache consistency strategy |
| C2 | Alter Redis TTL or eviction policy | Deferred | No cache latency or memory-pressure evidence |
| K1 | Increase Kafka partitions or tune producer | Deferred | Burst benchmark is not sustained app throughput |
| W1 | Change Socket.IO topology or room delivery | Deferred | 50-client isolated test passed; no multi-node evidence |
| T1 | Retain reproducible benchmark instrumentation | Accepted as existing verification infrastructure | Tests and artifacts enable later evidence-based decisions; no runtime tuning proposed |

**Production performance code changes accepted in Phase 25.8.7: 0.** This is a deliberate, evidence-backed outcome, not a failed phase.

## 4. Measurement caveats

1. REST scripted sleep constrains offered load; reported requests/second are not a server maximum.
2. Cross-run numbers from GitHub-hosted runners are not paired experiments controlling all sources of variance.
3. PostgreSQL sampling is of database sessions, not Node `pg.Pool.waitingCount`.
4. Redis hit/miss INFO counters are server-wide and dominated by explicit test commands.
5. Kafka's 12k messages/s represents an ~80 ms burst on a single local partition.
6. WebSocket tests use sequential client cohorts on one instance and explicit, not automatic, reconnects.
7. No multi-node, long-duration or fault-injection experiment has been completed for these paths.

## 5. Phase 25.8.8 validation plan

**Objective:** Establish a repeatability baseline while preserving the exact benchmark profile. As there are no accepted runtime optimizations, label results as **baseline rerun / stability verification**, not before-and-after performance gain.

1. Keep current feature branch and isolated service topology; do not merge to main.
2. Record workflow run ID, commit SHA, runner type, date and profile.
3. Run the same `capacity` profile at least three times on the same code/configuration, avoiding overlapping workloads.
4. Preserve raw REST, SQL/connection, Redis, Kafka, WebSocket and live-delivery artifacts for each run.
5. Compare per-run requests, success/429/error counts, p50/p95/p99, producer rate, consumer lag, connected clients, delivery integrity and reconnection evidence. Preserve distributions rather than treating percentage differences as optimization gains.
6. Fail verification on functionality/regression thresholds, not on arbitrary tiny CI latency fluctuations. Define performance regression thresholds before making comparison claims.
7. If a specific reproducible issue emerges, return to 25.8.7 with an isolated patch and matched before/after runs.

## 6. Disposition

**Phase 25.8.7: COMPLETE — audit and explicit no-change decision.**  
**Next:** Phase 25.8.8, repeatability verification on the current branch.  
**Report target:** `docs/performance/PHASE_25_8_8_BEFORE_AFTER_BENCHMARKS.md` (use an accurate 'repeatability' title within the report if no change occurs).  
**No PR or merge requested.**

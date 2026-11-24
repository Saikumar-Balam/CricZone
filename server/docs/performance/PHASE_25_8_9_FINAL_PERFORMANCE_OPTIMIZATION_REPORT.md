# CricZone — Phase 25.8.9 Final Performance Optimization Report

**Report date:** 2026-11-24 (UTC)  
**Repository:** `Saikumar-Balam/CricZone`  
**Branch under review:** `feat/rest-api-baseline-25-8-1`  
**Status:** Phase 25.8 analysis and CI verification complete within the specified workload; final evidence-package identity check outstanding  
**Decision:** **No production performance-tuning changes accepted.** There is no supported before/after optimization speedup claim.

## 1. Executive conclusion

CricZone's isolated GitHub Actions capacity benchmarks demonstrate low measured REST, PostgreSQL and Redis latencies; successful short Kafka bursts; and functioning WebSocket room lifecycle and live-ball fan-out at 10, 25 and 50 concurrent clients. The two independent repeat runs preserved application correctness, but REST response latency varied materially between runs. The evidence therefore supports **functional repeatability within tested workloads**, not production-scale capacity, maximum throughput, or a causal performance improvement.

The 25.8.7 source audit explicitly rejected speculative production tuning. Phase 25.8.8 is consequently a **repeatability comparison**, not a controlled before/after experiment involving an optimization patch.

## 2. Environment and method

- GitHub-hosted Ubuntu 24.04; one localhost Node.js/Express instance; PostgreSQL 18.7; Redis 7.4.12; local Kafka 3.9.1; Socket.IO with Redis adapter.
- Capacity-only CI safeguards (`NODE_ENV=test`, `GITHUB_ACTIONS=true`, `ISOLATED_TEST_ENV=true`, `PROFILE=capacity`, `CRICZONE_CI_CAPACITY_TEST=true`) and local API target `http://127.0.0.1:3000`.
- CI-only rate limit 10,000 requests/60 seconds/IP; this must not be confused with the regular 100-request/minute setting or production performance.
- REST capacity: 10 VUs, 30 seconds, **200 ms client sleep**; endpoint-isolated testing: six 30-second sequential scenarios, 10/25 VUs.
- Database profile uses a tiny seeded fixture (3 matches; 1 scorecard; 2 innings; 6 batting and 4 bowling rows).
- Kafka throughput uses a dedicated test consumer, one partition and an approximately 60–80 ms 1,000-message burst; it does not measure the application consumer's sustained throughput.
- WebSocket room lifecycle and end-to-end delivery use sequential 10/25/50-client cohorts on one app instance; reconnections are explicitly initiated by the benchmark.
- **Commit SHA and run IDs for the independent repeat runs have not been confirmed in the supplied comparison evidence.** Verify these before asserting code identity across repeats.

## 3. Verified measurement ledger

### 3.1 REST capacity, 10 VUs / 30 seconds

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Requests | 1,481 | 1,490 | 1,480 |
| Requests/sec | 49.034 | 49.365 | 49.087 |
| Mean latency (ms) | 2.114 | 1.834 | 3.055 |
| Overall p95 (ms) | 3.527 | 3.012 | 5.475 |
| Matches p95 (ms) | 2.701 | 2.196 | 3.520 |
| Match detail p95 (ms) | 3.236 | 2.835 | 5.393 |
| Scorecard p95 (ms) | 3.861 | 3.408 | 6.075 |
| HTTP failures / 429 / 5xx | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

Repeat 2 REST p95 increased **81.8%** relative to repeat 1 (3.012 → 5.475 ms); request rate changed by about **−0.56%**. The pacing means throughput is principally load-generator-constrained. The p95 increase is a real *observed between-run difference*, but there is no evidence to attribute it to a code regression or a particular subsystem.

### 3.2 Endpoint-isolated REST runs

| Scenario p95 (ms) | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Matches, 10 VUs | 3.084 | 3.423 | 4.247 |
| Match detail, 10 VUs | 3.522 | 4.612 | 5.346 |
| Scorecard, 10 VUs | 3.633 | 3.654 | 6.108 |
| Matches, 25 VUs | 3.393 | 3.641 | 5.123 |
| Match detail, 25 VUs | 4.079 | 3.201 | 6.833 |
| Scorecard, 25 VUs | 3.297 | 4.524 | 5.403 |
| Total requests | 15,632 | 15,602 | 15,540 |

All endpoint runs reported zero HTTP errors and 100% validity checks. Repeat 2's six p95 figures were all higher than repeat 1's, but still <7 ms. The k6 2,000 ms p95 thresholds are **provisional** and must be reconciled with Phase 25.1 before claiming formal product SLO compliance.

### 3.3 PostgreSQL

The repeat-2 `EXPLAIN (ANALYZE, BUFFERS)` evidence included a matches join at **0.117 ms**, pending outbox check **0.010 ms**, scorecard **0.006 ms**, innings **0.036 ms**, batting **0.029 ms**, and bowling **0.025 ms**. The 200 PostgreSQL connection samples showed at most **10 connections**, at most **2 active**, and one sampled active wait. These numbers do not measure `pg.Pool.waitingCount` and the small fixture cannot establish realistic production query behavior. **No index or pool-size change recommended.**

### 3.4 Redis

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| GET-hit p95 (ms) | 0.401 | 0.147 | 0.201 |
| GET-miss p95 (ms) | 0.157 | 0.089 | 0.097 |
| SET p95 (ms) | 0.305 | 0.145 | 0.210 |
| DEL p95 (ms) | 0.163 | 0.212 | 0.205 |
| Cache population / 60s TTL / payload equality | Pass | Pass | Pass |
| Evictions | 0 | 0 | 0 |

Each command class has 100 observations per run. Cold/warm HTTP requests are **individual observations**, not a statistically robust caching speedup. `MatchService` deliberately retains PostgreSQL pending-invalidation checks in the cache read path; omitting them to improve hit latency was rejected because it would weaken consistency safeguards. The `noeviction`/unbounded maxmemory settings here describe the isolated CI Redis instance, not recommended production settings.

### 3.5 Kafka

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Produced / unique consumed | 1,000 / 1,000 | 1,000 / 1,000 | 1,000 / 1,000 |
| Producer rate (messages/s) | 12,424 | 16,667 | 17,238 |
| End-to-end rate (messages/s) | 12,218 | 16,285 | 16,813 |
| Delivery p95 (ms) | 38 | 33 | 37 |
| Committed lag | 0 | 0 | 0 |
| Missing / duplicate | 0 / 0 | 0 / 0 | 0 / 0 |

The results establish successful **short single-partition bursts only**. Do not claim the application can continuously process 17,238 live scoring events/second.

### 3.6 Socket.IO connections and live event delivery

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Connection success | 85/85 | 85/85 | 85/85 |
| Joins / leaves / disconnects | 85 each | 85 each | 85 each |
| 50-client connection p95 (ms) | 23.844 | 12.667 | 18.299 |
| Unique persisted `BALL_RECORDED` events | 6/6 | 6/6 | 6/6 |
| Live notifications delivered | 170/170 | 170/170 | 170/170 |
| Missing / duplicate notifications | 0 / 0 | 0 / 0 | 0 / 0 |
| Explicit reconnect-and-resubscribe clients | 17/17 | 17/17 | 17/17 |
| 50-client live event initial p95 (ms) | 17.302 | 13.137 | 13.302 |
| 50-client post-reconnect p95 (ms) | 17.359 | 12.128 | 10.881 |

The 170 notifications are fan-out observations arising from **six underlying broadcast events per run**. These observations cannot be treated as 170 independent trials of server-side event processing. Automatic reconnection after faults, durable catch-up, multi-node Redis adapter behavior, and sustained high fan-out remain outside this evidence.

## 4. Optimization decision register (Phase 25.8.7)

| Candidate | Decision | Reason |
|---|---|---|
| Raise production API rate limits | Rejected | Earlier 429 responses corresponded to intended limiter behavior, not demonstrated saturation |
| Add SQL indexes or increase PG pool | Deferred | Tiny CI fixture and no observed pool queue measurement |
| Remove Postgres invalidation check on Redis hit | Rejected | Preserves correctness and cache consistency |
| Change Redis TTL/eviction settings | Deferred | No measured bottleneck or representative memory pressure |
| Raise Kafka partitions or tune producer/consumer | Deferred | Only short synthetic single-partition burst measured |
| Change Socket.IO adapter/transport parameters | Deferred | Correctness and acceptable measured latency at 50 clients; no multi-node stress evidence |

**Accepted production performance-tuning changes: zero.** No speedup percentage should be presented as due to an optimization patch.

## 5. Closure assessment

| Phase | Evidence-based disposition |
|---|---|
| 25.8.1 | REST capacity evidence collected and validated |
| 25.8.2 | REST endpoint isolation analyzed; no verified saturation bottleneck |
| 25.8.3 | SQL plans and PG connection sampling analyzed; dataset-scale limitation documented |
| 25.8.4 | Cache correctness, TTL and Redis command timing analyzed |
| 25.8.5 | Kafka producer and dedicated consumer short-burst integrity and lag analyzed |
| 25.8.6 and 25.8.6.5 | WebSocket lifecycle, live Kafka-to-Socket.IO fan-out, persistence and explicit reconnections verified |
| 25.8.7 | Optimization candidates reviewed, with explicit no-production-tuning decision |
| 25.8.8 | Earlier reference plus two CI repeats compared; functional checks passed, latency variability documented |
| 25.8.9 | Final consolidation report prepared; audit-trail verification listed below remains open |

## 6. Outstanding evidence and recommended next measurements

**Administrative closure checks**

1. Capture the three relevant GitHub Actions `run_id`, `head_sha`, workflow revision, and artifact names; confirm repeat 1 and repeat 2 have the same commit SHA before describing them as same-code repeatability trials.
2. Preserve raw JSON, PostgreSQL execution plans, PG connection CSVs and server logs in or linked from an immutable evidence index. Report filenames are not substitutes for raw evidence.
3. Confirm Phase 25.1 SLO requirements before announcing production SLO compliance; current 2,000 ms k6 thresholds are provisional.

**Future tests if preparing for production-scale claims**

- More independent trials and a controlled open-loop/constant-arrival REST test with warm-up, resource metrics, and stable load-generation host.
- Larger representative PostgreSQL data, `pg.Pool.waitingCount`, timeouts, query plans and concurrency.
- Redis invalidation race tests and deployment-specific memory/eviction assessment.
- Sustained Kafka application-consumer workload, rebalance/retry/DLQ and backlog recovery.
- Longer-lived WebSocket connections, automatic reconnect, slow clients, multi-node fan-out and Redis adapter failure/recovery.

## 7. Final sign-off statement

**Phase 25.8 is complete as an isolated CI benchmarking and evidence-based optimization decision exercise.** The tested paths repeatedly met their functional checks; repeat 2 showed higher REST latency than repeat 1; and no production performance changes were justified. This report makes **no claim of production capacity, production SLO compliance, or a code-derived performance improvement**. Administrative verification of matching repeat-run commit SHAs and archival of raw artifacts is still outstanding.

**Branch handling:** Remain on `feat/rest-api-baseline-25-8-1`; no PR or merge was performed as part of this report.

## 8. Companion reports

- `docs/performance/PHASE_25_8_1_BENCHMARK_EVIDENCE.md`
- `docs/performance/PHASE_25_8_2_REST_BOTTLENECK_ANALYSIS.md`
- `docs/performance/PHASE_25_8_3_POSTGRESQL_ANALYSIS.md`
- `docs/performance/PHASE_25_8_4_REDIS_CACHE_ANALYSIS.md`
- `docs/performance/PHASE_25_8_5_KAFKA_ANALYSIS.md`
- `docs/performance/PHASE_25_8_6_WEBSOCKET_ANALYSIS.md`
- `docs/performance/PHASE_25_8_7_OPTIMIZATION_DECISIONS.md`
- `docs/performance/PHASE_25_8_8_BENCHMARK_COMPARISON.md`

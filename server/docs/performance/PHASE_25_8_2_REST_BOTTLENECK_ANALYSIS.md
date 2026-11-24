# CricZone Phase 25.8.2 — REST API Bottleneck Analysis

**Status:** Endpoint-isolated baseline analysis complete for 10 and 25 VUs; performance saturation and production bottlenecks not proven.  
**Evidence date:** 2026-11-24  
**Target:** Isolated GitHub-hosted runner; `http://127.0.0.1:3000`  
**Branch used for test development:** `feat/rest-api-baseline-25-8-1`  
**Script:** `server/load-tests/rest-api-bottlenecks.js`

## Executive summary

Six sequential endpoint-isolated k6 scenarios were run against seeded CricZone read-only REST endpoints: match list, match detail and scorecard, each at **10 VUs** and **25 VUs**. The most recent supplied report contains **15,540 requests, zero HTTP failures, zero 429/5xx responses and 31,080/31,080 passing checks**. Scenario-specific p95 latencies remained under **6.37 ms** in that run. With fixed 200 ms pacing, throughput increased close to the 2.5x VU increase, but this does **not** establish maximum throughput or linear scaling at higher load.

**Primary investigation candidate:** Match detail shows the largest 10-to-25 VU p95 increase across two endpoint-isolated runs. Scorecard uses multiple SQL queries per request and warrants follow-up, but it is not conclusively the bottleneck. No application optimization is authorized by this evidence alone.

## 1. Workload and guardrails

| Property | Value |
|---|---|
| Test type | Endpoint-isolated; sequential, nonoverlapping scenarios |
| Endpoints | `GET /api/v1/matches`, `/api/v1/matches/1`, `/api/v1/matches/1/scorecard` |
| Per-endpoint load | 10 VUs for 30 seconds; 25 VUs for 30 seconds |
| Request pacing | 0.2 s per iteration |
| Environment | Local Express + seeded PostgreSQL + Redis + Kafka on CI runner |
| Rate limiting | Explicit, gated CI-only capacity allowance of 10,000/min/IP |
| Response validation | HTTP 200; JSON `success === true`; non-null `data` |
| Thresholds | `checks >99%`, `http_req_failed <1%`, scenario p95 <2,000 ms provisional |
| Scenario throughput | Requests divided by **30 seconds**, not total multi-scenario job duration |

The six scenarios start 35 seconds apart, allowing the prior 30-second scenario to finish before the next begins. This prevents simultaneous load from different target endpoints, but runner state/cache warmness can still change across scenarios.

## 2. Latest complete endpoint-isolated result

**Tested at:** 2026-11-24 10:50:56 UTC.

| Scenario | Requests | Approx. requests/s | Mean (ms) | p95 (ms) | Max (ms) |
|---|---:|---:|---:|---:|---:|
| `matches_10` | 1,480 | 49.33 | 2.604 | 4.184 | 9.370 |
| `match_detail_10` | 1,480 | 49.33 | 3.150 | 5.076 | 19.304 |
| `scorecard_10` | 1,480 | 49.33 | 2.790 | 4.798 | 15.773 |
| `matches_25` | 3,700 | 123.33 | 2.622 | 5.029 | 13.579 |
| `match_detail_25` | 3,700 | 123.33 | 2.528 | 6.366 | 16.376 |
| `scorecard_25` | 3,700 | 123.33 | 2.805 | 5.368 | 17.518 |

| Global metric | Result |
|---|---:|
| HTTP requests | 15,540 |
| HTTP failure rate | 0% |
| HTTP 429 | 0 |
| HTTP 5xx | 0 |
| Validation checks | 31,080 passed / 31,080 total |
| Overall average response latency | 2.708 ms |
| Overall p95 response latency | 5.171 ms |

All applicable k6 thresholds passed. The overall `http_reqs.rate` from k6 is averaged over the entire multi-scenario run; it should not be reported as the per-scenario throughput.

### Latency change with concurrency (latest run)

| Endpoint | p95 at 10 VUs | p95 at 25 VUs | Difference | Relative change |
|---|---:|---:|---:|---:|
| Matches list | 4.184 ms | 5.029 ms | +0.845 ms | +20.2% |
| Match detail | 5.076 ms | 6.366 ms | +1.290 ms | +25.4% |
| Scorecard | 4.798 ms | 5.368 ms | +0.570 ms | +11.9% |

The latest run ranks **match detail** highest for p95 at 25 VUs and for relative p95 growth over the tested concurrency change.

## 3. Independent previous scenario repetition

**Tested at:** 2026-11-24 10:03:45 UTC. The same six scenario labels were measured successfully after correcting the k6 report to explicitly register scenario-tagged submetrics.

| Endpoint | 10-VU p95 (ms) | 25-VU p95 (ms) | Relative change |
|---|---:|---:|---:|
| Matches list | 4.431 | 5.871 | +32.5% |
| Match detail | 5.382 | 7.228 | +34.3% |
| Scorecard | 6.217 | 6.523 | +4.9% |

The previous run recorded **15,505 requests**, zero HTTP failures, zero 429/5xx responses and 31,010/31,010 checks passing. The differences between repetitions are run-to-run variability, not demonstrated improvement or regression. The earlier attempt with `null` per-scenario fields was a summary **instrumentation failure**; its aggregate success metrics are informative but its per-scenario comparisons are unusable.

## 4. Code-path observations and bottleneck hypotheses

### Matches list

`MatchService.getMatches()` delegates to a PostgreSQL match repository lookup that joins matches to reference entities and orders by start time. Its measured latency rises with VU count, but it returned correct responses across all scenarios. No query bottleneck is confirmed.

### Match detail

`MatchService.getMatchById()` checks PostgreSQL-backed cache invalidation state before serving cached data and rechecks pending invalidation status before returning a cache hit. It falls back to the authoritative PostgreSQL match repository when needed. These consistency checks are intentionally fail-closed; removing them to reduce latency would risk stale responses. We should measure the separate outbox query, Redis GET, and PostgreSQL fallback timings before considering adjustments.

### Scorecard

`ScorecardService.getScorecardByMatchId()` fetches the scorecard, then innings, then batting and bowling performances for each innings. The total count is **2 + 2N SQL queries** when there are N innings; two innings imply six queries. Some subqueries are issued concurrently through `Promise.all`, so six queries does not mean six sequential round trips. This is a plausible fan-out/scaling concern and a Phase 25.8.3 profiling target, not evidence that SQL rewrites will improve current latency.

## 5. Bottleneck ranking and interpretation

| Priority | Candidate | Evidence | Current decision |
|---|---|---|---|
| 1 | Match-detail consistency/cache lookup overhead | Largest p95 growth at 10-to-25 VUs in both observed repeats | Instrument outbox/cache latency; preserve consistency rules |
| 2 | Scorecard repository query fan-out | Multiple SQL queries per innings, potential cost as innings/data grow | Profile representative SQL and DB round trips |
| 3 | Match-list joins and sorting | p95 rises with VUs, but remains low in these tests | Monitor with realistic match volume; no premature index change |

**No confirmed saturation:** A 200 ms sleep means a VU can issue roughly five requests per second even when application latency is tiny. At 10 VUs this yields about 50 req/s and at 25 VUs about 125 req/s by construction. The achieved rates are near that pacing ceiling, not proven system limits. Increasing VUs and removing or reducing sleep in a strictly isolated test, while observing CPU, memory, pool queueing and error thresholds, is necessary before claiming saturation throughput.

## 6. Validation, limits and decision

**Validated**

- All six scenario-specific request counts and latency metrics were captured in two complete runs.
- All applicable k6 thresholds passed for the documented workload.
- No 429 responses were observed in CI-only capacity mode; the prior normal-rate-limit stress test is separately preserved under Phase 25.8.1.
- Match detail displayed the largest proportional p95 growth in both repetitions.

**Limitations**

- Database contains a very small seed and only one sampled match/scorecard; production cardinality and cache churn differ.
- Runs are on a single GitHub-hosted machine over loopback; no client-network, multi-host or production resource latency is included.
- Workload uses fixed per-iteration sleep; results cannot establish saturation, max throughput or sustained reliability at more demanding load.
- Tests are sequential; cache warmness, operating-system scheduling and CPU demand can vary with scenario ordering.
- No resource-aligned CPU/heap/event-loop, Redis round-trip or Node `pg.Pool.waitingCount` instrumentation accompanies the isolated k6 data.
- Phase 25.1 approved performance SLOs have not been reconciled; the p95 <2,000 ms threshold is provisional.

**Decision:** Treat Phase 25.8.2's **endpoint-level bottleneck ranking as complete for the tested CI scope**, but do not label any component a proven production bottleneck and do not optimize solely from the ranking. Use Phase 25.8.3 PostgreSQL evidence and Phase 25.8.4 Redis/cache profiling to decide whether optimization is warranted.

## 7. Recommended follow-up

1. Preserve the two complete endpoint-isolated JSON reports and the 25.8.1 mixed-workload capacity baseline as before-optimization references.
2. Reconcile the PostgreSQL plans and pool-connection samples documented in `PHASE_25_8_3_POSTGRESQL_ANALYSIS.md`.
3. In Phase 25.8.4, instrument match-detail cache hits/misses, Redis command latency and correctness under invalidation; do not weaken fail-closed safeguards.
4. Reserve any changes to service architecture, indexes, or pool sizing for Phase 25.8.7, with Phase 25.8.8 before/after verification.

**Closure:** Phase 25.8.2 is complete as an **initial evidence-backed REST bottleneck analysis** for this CI environment. Higher-scale bottleneck confirmation remains future work.

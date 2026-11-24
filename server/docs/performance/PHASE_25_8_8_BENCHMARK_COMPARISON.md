# Phase 25.8.8 — Benchmark Repeatability and Comparison

**Project:** CricZone  
**Branch:** `feat/rest-api-baseline-25-8-1`  
**Test environment:** Isolated GitHub-hosted Ubuntu 24.04 runner, PostgreSQL 18.7, Redis 7.4.12, local Kafka broker, Node.js backend  
**Date:** 2026-11-24 (UTC)  
**Decision:** Functional repeatability demonstrated at tested loads; latency variation observed, especially REST. No optimization gain claimed.

## 1. Purpose and scope

Phase 25.8.7 did not approve any performance-specific changes. Accordingly, Phase 25.8.8 is **not** a code-change before/after study. It compares an earlier capacity benchmark reference and two subsequent independent capacity runs to assess functional repeatability, gross regressions, and measurement variability.

All figures are measured on short-lived CI workloads with small seeded data. The same commit SHA has **not been independently verified** for both repeat runs. Confirm the `head_sha` for both GitHub Actions runs before treating their environment and code revision as fully frozen.

### Run identity

| Evidence | Reference | Repeat 1 | Repeat 2 |
|---|---|---|---|
| REST baseline timestamp (UTC) | 2026-11-24 11:29:19 | 2026-11-24 14:53:17 | 2026-11-24 15:02:18 |
| REST bottleneck timestamp | 2026-11-24 11:32:44 | 2026-11-24 14:56:43 | 2026-11-24 15:05:43 |
| Profile | capacity | capacity | capacity |
| Commit SHA | not captured here | not supplied | not supplied |

## 2. REST capacity benchmark (10 VUs, 30 seconds, 0.2-second sleep)

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Requests | 1,481 | 1,490 | 1,480 |
| Requests/sec | 49.034 | 49.365 | 49.087 |
| Mean request duration (ms) | 2.114 | 1.834 | 3.055 |
| Overall p95 (ms) | 3.527 | 3.012 | 5.475 |
| `/matches` p95 (ms) | 2.701 | 2.196 | 3.520 |
| `/matches/1` p95 (ms) | 3.236 | 2.835 | 5.393 |
| `/matches/1/scorecard` p95 (ms) | 3.861 | 3.408 | 6.075 |
| HTTP 429 | 0 | 0 | 0 |
| HTTP 5xx | 0 | 0 | 0 |
| HTTP failure rate | 0% | 0% | 0% |
| API validity checks | passed | 2,980/2,980 | 2,960/2,960 |

**Repeat 2 vs repeat 1:** throughput −0.56%; overall p95 +81.8%; average latency +66.6%. There is a meaningful *observed* latency change, but insufficient evidence to attribute it to a code regression, database, Kafka, cache, or infrastructure saturation. The workload's fixed sleep dominates the observed request rate; near-constant throughput does not prove capacity remained unchanged under an open-loop load.

### Endpoint-isolated p95, milliseconds

| Endpoint/scenario | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| matches, 10 VUs | 3.084 | 3.423 | 4.247 |
| match detail, 10 VUs | 3.522 | 4.612 | 5.346 |
| scorecard, 10 VUs | 3.633 | 3.654 | 6.108 |
| matches, 25 VUs | 3.393 | 3.641 | 5.123 |
| match detail, 25 VUs | 4.079 | 3.201 | 6.833 |
| scorecard, 25 VUs | 3.297 | 4.524 | 5.403 |
| Total requests | 15,632 | 15,602 | 15,540 |
| HTTP failures / 429 / 5xx | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Validity check pass rate | 100% | 100% | 100% |

Repeat 2 had higher p95 values across all six isolated endpoint scenarios relative to repeat 1. Nevertheless, all recorded p95s were <7 ms and passed the benchmark's **provisional** 2,000 ms thresholds. These thresholds must be reconciled with Phase 25.1 before being presented as production SLOs.

## 3. Redis cache and command round trips

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Cold HTTP request (ms; one sample) | 32.260 | 21.793 | 29.278 |
| Warm HTTP request (ms; one sample) | 4.407 | 2.728 | 3.660 |
| GET hit p95 (ms; 100 samples) | 0.401 | 0.147 | 0.201 |
| GET miss p95 (ms) | 0.157 | 0.089 | 0.097 |
| SET p95 (ms) | 0.305 | 0.145 | 0.210 |
| DELETE p95 (ms) | 0.163 | 0.212 | 0.205 |
| Cache populated / TTL | Yes / 60 sec | Yes / 60 sec | Yes / 60 sec |
| Cold/warm payload equal | Yes | Yes | Yes |
| Evicted keys | 0 | 0 | 0 |

Single cold/warm samples are illustrative only, not evidence of stable acceleration. Redis INFO hit/miss deltas are server-wide and mainly reflect test-generated operations; they do not measure application cache hit rate. The benchmark did not test concurrent cache invalidation.

## 4. Kafka broker and dedicated test-consumer results

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Produced | 1,000 | 1,000 | 1,000 |
| Unique consumed | 1,000 | 1,000 | 1,000 |
| Producer throughput (msg/s) | 12,424 | 16,667 | 17,238 |
| End-to-end throughput (msg/s) | 12,218 | 16,285 | 16,813 |
| Delivery p95 (ms) | 38 | 33 | 37 |
| Final committed consumer lag | 0 | 0 | 0 |
| Missing / duplicate records | 0 / 0 | 0 / 0 | 0 / 0 |

The Kafka test used one partition and a dedicated benchmark consumer. The results do not establish sustained throughput of CricZone's real event-processing consumer, which was covered separately in a functional live-event test at lower event volume.

## 5. WebSocket connection lifecycle

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Total successful connections | 85/85 | 85/85 | 85/85 |
| Room joins / leaves / disconnects | 85 each | 85 each | 85 each |
| 10-client connection p95 (ms) | 33.052 | 28.714 | 32.480 |
| 25-client connection p95 (ms) | 15.746 | 13.174 | 8.219 |
| 50-client connection p95 (ms) | 23.844 | 12.667 | 18.299 |

The cohorts were tested sequentially, on one backend instance. These tests do not establish sustained connection capacity, automatic reconnect/backoff reliability, or multi-instance Redis adapter failover.

## 6. Kafka → PostgreSQL → Redis → WebSocket delivery

| Metric | Reference | Repeat 1 | Repeat 2 |
|---|---:|---:|---:|
| Distinct `BALL_RECORDED` events | 6 | 6 | 6 |
| Exactly-one persisted delivery/event ID | 6/6 | 6/6 | 6/6 |
| Client notifications | 170/170 | 170/170 | 170/170 |
| Missing / duplicate notifications | 0 / 0 | 0 / 0 | 0 / 0 |
| Explicitly reconnected clients | 17/17 | 17/17 | 17/17 |
| 50-client initial publish-to-client p95 (ms) | 17.302 | 13.137 | 13.302 |
| 50-client post-reconnect p95 (ms) | 17.359 | 12.128 | 10.881 |

Six events are six broadcast samples, not 170 independent event-processing samples. Latencies include the full live-event pipeline and local runner scheduling. The test did not simulate loss of a Kafka broker, Redis node, network partition, or unexpected client reconnect behavior.

## 7. PostgreSQL evidence from repeat 2

The supplied PostgreSQL 18.7 query-plan output shows 3 matches, 1 scorecard, 2 innings, 6 batting-performances and 4 bowling-performances rows. Individual recorded query execution times include: matches join 0.117 ms; outbox pending check 0.010 ms; scorecard 0.006 ms; innings 0.036 ms; batting 0.029 ms; bowling 0.025 ms.

The supplied `postgresql-connections(2).csv` contains **200 samples**: maximum client backend count 10; maximum active 2; at least one active connection in 5 samples; a sampled active wait event in **one** sample. `pg_stat_activity` wait fields are not a measure of Node.js `pg.Pool.waitingCount`, so application pool queueing has **not** been ruled out by these observations.

The tiny CI dataset cannot validate large-table query plans or determine whether additional indexes will be useful at production-like scale. No index or pool-size changes are justified by these measurements alone.

## 8. Findings and decision ledger

| Finding | Evidence | Decision |
|---|---|---|
| Functional correctness repeatable | REST checks 100%; Kafka integrity and zero committed lag; 170/170 Socket.IO messages | **Pass within tested scope** |
| REST latency higher in repeat 2 | p95 3.012 → 5.475 ms; all six isolated endpoints higher | **Observed variability; investigate if persistent** |
| No HTTP error/429 issue | 0 failures under CI capacity mode | **No rate-limit change** |
| No confirmed PostgreSQL bottleneck | Small dataset, very short SQL execution, low sampled active usage | **Defer SQL/index tuning** |
| Redis command latency low | GET-hit p95 0.147–0.201 ms across repeat runs | **Defer cache tuning** |
| Kafka stable under burst | 1,000/1,000, zero lag, no integrity faults | **Defer Kafka tuning** |
| WebSocket correct at tested loads | 85/85 connections; 170/170 live notifications | **Defer Socket.IO tuning** |

**Final Phase 25.8.8 conclusion:** PASS for functional repeatability and provisional thresholds; **inconclusive for performance improvement/regression causality**. No optimization benefit is claimed. Phase 25.8.7 authorized no performance-specific production changes.

## 9. Follow-up and closure conditions

1. Record the GitHub Actions run IDs and verify both repeat runs used the same commit SHA and workflow configuration.
2. Preserve all original JSON artifacts, the PostgreSQL EXPLAIN output and connection CSVs. No fabricated or smoothed metrics should replace raw evidence.
3. If REST p95 variation matters to the target SLO, run additional paired capacity trials on consistent runners, control warm-up and workload ordering, and collect Node `pg.Pool` queue metrics and CPU/event-loop data.
4. Reconcile the provisional 2,000 ms k6 threshold against Phase 25.1 SLO definitions before giving a production pass/fail claim.
5. Proceed to **25.8.9 Final Performance Optimization Report** with a scope-limited, evidence-based outcome and these limitations.


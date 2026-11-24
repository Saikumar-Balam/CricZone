# CricZone Performance Analysis — Phase 25.8.5: Kafka Throughput and Consumer Lag

**Status:** Initial isolated benchmark completed; findings documented  
**Test date:** 2026-11-24 12:07:13.864 UTC (timestamp as reported by the benchmark)  
**Target:** Isolated GitHub-hosted runner  
**Git branch:** `feat/rest-api-baseline-25-8-1`  
**Scope:** Kafka broker plus dedicated benchmark producer and consumer; **not** CricZone's application event-processing consumer

## 1. Objective

Measure short-burst Kafka producer throughput, end-to-end throughput, message-delivery latency, offset commitment, and delivery integrity in CricZone's isolated CI environment. Identify evidence-backed reasons, if any, to optimize Kafka configuration before subsequent scalability work.

## 2. Test Configuration

| Property | Value |
|---|---|
| Phase | `25.8.5` |
| Profile | CI-only capacity benchmark |
| Test type | `kafka-broker-and-test-consumer` |
| Topic | `criczone.perf.45390312528` |
| Consumer group | `criczone-perf-45390312528` |
| Partitions | 1 |
| Expected records | 1,000 |
| Target | Isolated GitHub-hosted runner |
| Input script | `server/scripts/profile-kafka.mjs` |
| Evidence artifact | `server/benchmark-evidence/kafka-profile.json` |

The benchmark uses a dedicated performance topic and consumer group so that its results do not imply anything about the behavior of CricZone's live-ball-event consumer.

## 3. Measured Results

### 3.1 Producer and end-to-end throughput

| Metric | Observed result |
|---|---:|
| Expected messages | 1,000 |
| Produced messages | 1,000 |
| Unique messages consumed | 1,000 |
| Producer duration | 80.490087 ms |
| Producer throughput | 12,423.890162 messages/second |
| End-to-end duration | 81.848041 ms |
| End-to-end throughput | 12,217.763404 messages/second |
| Consumer active duration | 44 ms |

These are **short-burst** rates derived from the reported test intervals. They are not sustained maximum-throughput measurements. The `consumer active duration` is the time between first and last observed consumption, not a separately measured steady-state capacity.

### 3.2 Message-delivery latency

| Statistic | Milliseconds |
|---|---:|
| Mean | 15.167 |
| p50 | 14 |
| p95 | 38 |
| p99 | 38 |
| Maximum | 38 |
| Samples | 1,000 |

The timestamp-based delivery latency includes batching and runtime scheduling effects; it should not be interpreted as broker-only network latency.

### 3.3 Offset verification and data integrity

| Verification | Observed result |
|---|---:|
| Partition end offset | 1,000 |
| Group committed offset | 1,000 |
| **Final committed consumer lag** | **0** |
| Missing messages | 0 |
| Duplicate messages | 0 |

All 1,000 expected message IDs were observed exactly once by the benchmark consumer, and the final committed group offset matched the partition end offset. The reported **zero lag is a final snapshot**, not proof that lag never arose during production or consumption.

## 4. Interpretation

1. **Delivery integrity passed within the tested scope.** The benchmark produced 1,000 messages and recorded 1,000 unique consumed messages, with no missing or duplicate IDs.
2. **Final backlog was cleared.** Both the partition end offset and committed consumer offset were 1,000, giving a final lag of zero.
3. **Short-burst throughput was high on the isolated runner.** The measured producer and end-to-end rates exceeded 12,000 messages/second for this small, single-partition burst. These figures must not be presented as guaranteed application or production throughput.
4. **Latency was bounded within this run.** The recorded p95/p99 delivery latency was 38 ms. No latency service-level objective has been established by this isolated test.
5. **No evidence-backed Kafka tuning change is indicated.** This run contains no observed data-integrity failure, uncleared committed lag, or clear Kafka performance bottleneck at the tested load.

## 5. Limitations and Risks

- **Not the application consumer:** The dedicated benchmark consumer does not execute CricZone's real live-ball-event processing, database writes, cache invalidation, or socket broadcasting.
- **Single partition:** Partition parallelism and multi-consumer scaling were not tested.
- **Short test:** A 1,000-message burst cannot establish sustained throughput, stability, or long-term tail latency.
- **No sustained backlog test:** The report verifies only final committed lag, not a time series of lag during overload and recovery.
- **No fault recovery:** Broker failures, producer retries, consumer rebalances, restarts, and replay were not exercised.
- **CI-local environment:** Results from a GitHub-hosted runner with a local Kafka service are not representative of production network hops or deployment resource contention.
- **Measurement semantics:** Delivery latency derives from application timestamps; producer and end-to-end throughput use different elapsed-time windows.

## 6. Optimization Decision

**Decision: Defer Kafka optimization.** Preserve the present Kafka configuration and application behavior. The available evidence does not justify changing partition counts, batch sizes, acknowledgement settings, consumer concurrency, retry policies, or broker resource allocations.

An optimization should be considered only after a repeatable test identifies an actual bottleneck and provides a baseline for before/after comparison.

## 7. Recommended Follow-up Work

1. Instrument CricZone's actual `criczone.live.ball-events` consumer and record processing throughput, handler latency, retry/error counts, and application-side backlog.
2. Run sustained workloads over several minutes with concurrent producers and consumers, recording committed lag over time.
3. Test recovery from slow processing, consumer restart, rebalance, and transient broker unavailability in isolated CI.
4. If warranted, compare partition counts, batching, and consumer concurrency using identical datasets and controlled test conditions.
5. Preserve raw JSON artifacts and GitHub Actions run identifiers alongside subsequent evidence.

## 8. Phase 25.8.5 Checklist

| Substep | Description | Status |
|---|---|---|
| 25.8.5.1 | Inspect isolated Kafka environment | Completed |
| 25.8.5.2 | Measure producer throughput | Completed for test producer |
| 25.8.5.3 | Measure consumer throughput | Completed for dedicated test consumer |
| 25.8.5.4 | Verify consumer offsets and lag | Completed; final committed lag = 0 |
| 25.8.5.5 | Validate message delivery integrity | Completed; 0 missing and 0 duplicate IDs |
| 25.8.5.6 | Publish Kafka findings | Report prepared; repository commit pending |

## 9. Evidence and Reproducibility

- **Reported source:** Phase `25.8.5` benchmark JSON dated `2026-11-24T12:07:13.864Z` supplied with the test results.
- **Script path:** `server/scripts/profile-kafka.mjs`
- **Generated evidence path:** `server/benchmark-evidence/kafka-profile.json` (GitHub Actions artifact, not a tracked repository file by default)
- **Report path:** `docs/performance/PHASE_25_8_5_KAFKA_ANALYSIS.md`
- **Workflow:** `.github/workflows/rest-api-baseline.yml`, selected branch `feat/rest-api-baseline-25-8-1`, `capacity` profile.

This document records the observed benchmark results. It does **not** assert production Kafka readiness or CricZone end-to-end event-processing performance.

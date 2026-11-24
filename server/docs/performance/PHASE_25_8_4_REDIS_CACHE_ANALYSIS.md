# CricZone Phase 25.8.4 — Redis Cache Latency and Caching Analysis

**Status:** Initial evidence review complete; no Redis optimization approved.  
**Evidence date:** 2026-11-24 (test recorded at `2026-11-24T11:45:39.571Z`)  
**Environment:** Isolated GitHub-hosted runner; Redis 7.4.12  
**Working branch:** `feat/rest-api-baseline-25-8-1`  
**Scope:** `GET`, `SET`, and `DEL` round trips; match-detail cache-aside behavior for `/api/v1/matches/1`; TTL, memory, and eviction observations

## Executive summary

Phase 25.8.4 verified successful population of the `match:1` cache entry, a **60-second TTL**, and equal response payloads for one cold and one warm match-detail API request. The observed cold request took **32.260 ms** and the warm request took **4.407 ms**. This is a **7.32× ratio** (approximately **86.3% less elapsed time**) for that *single pair*, not an established performance improvement under repeated workloads.

Redis command round trips were low in the isolated runner: **p95 GET hit 0.401 ms**, **GET miss 0.157 ms**, **SET 0.305 ms**, and **DEL 0.163 ms**, with 100 samples of each operation. No Redis evictions were recorded during the profiling interval. The Redis instance used approximately **1.31 MB** and was configured with `maxmemory=0` and `maxmemory-policy=noeviction`.

**Decision:** Defer Redis cache rewrites, TTL adjustments, connection changes, and memory-policy changes. The existing CI evidence does not establish a Redis latency or eviction bottleneck. Obtain repeated, controlled cold/warm comparisons and concurrent invalidation tests before making optimization claims or changing consistency-sensitive behavior.

## 1. Test environment and application implementation

| Property | Value / observation |
|---|---|
| Test phase | `25.8.4` |
| Tested at | `2026-11-24T11:45:39.571Z` |
| Test target | `isolated-github-hosted-runner` |
| Redis server | `7.4.12` |
| Redis endpoint | Local CI Redis service (not a production deployment) |
| HTTP endpoint tested | `/api/v1/matches/1` |
| Cached match ID | `1` |
| Redis key | `match:1` |
| Configured match TTL | 60 seconds (`CacheTTL.MATCH`) |
| Command samples | 100 GET hits, 100 GET misses, 100 SET operations, 100 DEL operations |
| Cache implementation | `server/src/cache/RedisCache.js` |
| Match caching behavior | `server/src/services/MatchService.js` |
| Profiling script | `server/scripts/profile-redis-cache.mjs` |
| CI workflow | `.github/workflows/rest-api-baseline.yml` (`capacity` profile) |

`RedisCache` serializes cached objects as JSON and exposes `get`, `set`, and `delete`. `MatchService.getMatchById` uses cache-aside logic and checks the PostgreSQL invalidation outbox before serving a cached match. A Redis hit does **not** eliminate PostgreSQL consistency checks. This is important when interpreting warm-request timing and proposing future optimizations.

This run targeted **Redis**, not Valkey. Valkey-specific results require a separate run against the intended Valkey version and configuration.

## 2. Cache population, TTL, and API comparison

| Check / measurement | Observed result | Interpretation |
|---|---:|---|
| Cache entry initially removed | Yes | Establishes a cold lookup for the sampled match |
| Cache populated after cold request | `true` | Cache-aside population observed |
| TTL immediately after population | 60 seconds | Matches configured TTL |
| Cold match-detail HTTP request | 32.260434 ms | Single observation |
| Warm match-detail HTTP request | 4.407446 ms | Single observation |
| Cold vs warm response payload | Equal (`true`) | Sampled responses match |
| Cold/warm elapsed-time ratio | ~7.32× | Descriptive only; not a statistically validated speedup |
| Warm-request elapsed-time reduction | ~86.3% | Descriptive only; computed from one pair |

**Interpretation:** The warm sample is substantially faster than the cold sample while preserving the observed response payload. The cold sample may include connection, application warm-up, database, and cache-population costs. No p50, p95, distribution, or uncertainty interval for cold-versus-warm HTTP requests can be inferred from one pair.

Cache equality does not independently verify that an invalidated value cannot be served during concurrent writes or outbox transitions.

## 3. Redis command latency

The profiler measured Redis command round trips through the Node.js client. Times below are **milliseconds**, including client scheduling and communication overhead on the isolated CI runner. They are not Redis-server-only execution time.

| Operation | Samples | Mean | p50 | p95 | p99 | Max |
|---|---:|---:|---:|---:|---:|---:|
| GET hit | 100 | 0.141451 | 0.094954 | 0.401470 | 0.737098 | 1.515731 |
| GET miss | 100 | 0.084878 | 0.078139 | 0.156510 | 0.234189 | 0.258776 |
| SET | 100 | 0.146122 | 0.101978 | 0.304532 | 0.556396 | 1.925006 |
| DEL | 100 | 0.100314 | 0.092581 | 0.162748 | 0.195784 | 0.211321 |

**Interpretation:** No obvious command-round-trip bottleneck was observed at this sample count and workload. The higher hit p95 than miss p95 should not be interpreted as a general claim that Redis hits are inherently slower: the GET-hit path retrieves a serialized match payload, while the GET-miss probe returns no value, and the test was not designed as a size-controlled comparison.

## 4. Keyspace statistics and cache-hit interpretation

The profiler captured *server-wide* `INFO stats` counter changes during its own experiment:

| Counter change | Value |
|---|---:|
| `keyspace_hits` | 103 |
| `keyspace_misses` | 102 |
| `evicted_keys` | 0 |

The probe deliberately issued **100 GET hits and 100 GET misses**, in addition to API and validation activity. Consequently, `103 / (103 + 102) ≈ 50.2%` is **not** CricZone's application cache-hit ratio and must not be reported as such. Measuring application cache efficiency requires isolating production-like endpoint operations from benchmark-generated Redis commands, or adding controlled, non-sensitive cache metrics in the application.

The end-of-run keyspace snapshot was:

```text
db0: keys=1,expires=1,avg_ttl=59900,subexpiry=0
```

This describes only the short-lived CI Redis data state at the time of the snapshot.

## 5. Memory usage and eviction policy

| Setting / observation | Value |
|---|---|
| `used_memory` | 1,305,144 bytes (~1.31 MB decimal) |
| `used_memory_peak` | 1,317,128 bytes (~1.32 MB decimal) |
| `maxmemory` | `0` (no Redis-configured memory limit) |
| `maxmemory-policy` | `noeviction` |
| Evictions during profile | `0` |

**Assessment:** Memory use was small with one remaining cached key in this isolated test. No eviction pressure was observed. However, `maxmemory=0` does **not** mean infinite physical memory: host or container limits still apply. Under `noeviction`, writes can fail when memory cannot be allocated or when an applicable limit is reached; production suitability depends on the deployment's resource limits and desired failure behavior.

Do not change the production memory policy based solely on this CI result. Verify the target Redis/Valkey hosting configuration and test behavior near its actual memory limit first.

## 6. Consistency and safety assessment

**Verified by this test:**

- Removing `match:1` causes the sampled next API lookup to follow the cold path.
- A successful cold lookup populates `match:1`.
- The populated key has the configured 60-second TTL at measurement time.
- The one sampled cold response and warm response have equal JSON `data` payloads.
- Redis command probes complete, and no key evictions were observed in the measured interval.

**Not verified by this test:**

- Correct invalidation across concurrent match updates, races, or pending outbox transitions.
- Full application cache hit and miss rates under representative traffic.
- Cache stampede resistance or behavior when many clients request the same expired key simultaneously.
- Redis outage, reconnect, or recovery behavior under concurrent requests.
- TTL expiration behavior after the entire 60-second period (the observed TTL was measured just after population).
- Redis memory pressure, eviction, or write-failure behavior at production-scale key counts.
- Valkey behavior or equivalence to the tested Redis version.

## 7. Relationship to REST and PostgreSQL evidence

Phase 25.8.1 and 25.8.2 reported successful localhost CI REST benchmarks; Phase 25.8.3 found no sustained PostgreSQL query or server-side session bottleneck against a very small seeded dataset. The current Redis observations are consistent with those findings but do not independently establish a root cause for HTTP latency.

The match-detail endpoint can incur PostgreSQL consistency checks even when its Redis cache entry is present. Therefore **Redis command latency alone cannot explain end-to-end match-detail latency**, and any optimization that bypasses the outbox check needs separate correctness evidence.

## 8. Limitations and evidence quality

1. One cold HTTP request and one warm HTTP request are insufficient to estimate typical speedup, p95 latency, or statistical uncertainty.
2. Each Redis command category has only 100 sequential samples on one GitHub-hosted runner. No concurrent client saturation was tested.
3. All timings were measured against local services; production network latency, deployment resources, and client settings differ.
4. Redis `INFO` counters are server-wide, so the observed hit/miss changes include profiler-generated operations.
5. The current dataset contains very few cacheable entities. Memory and eviction behavior cannot be generalized to a larger working set.
6. Match-data consistency was checked by response equality, not by injecting concurrent updates or pending invalidation events.
7. This phase tested Redis 7.4.12 only, despite the broader phase title referencing Redis/Valkey.
8. Existing provisional HTTP p95 thresholds require separate Phase 25.1 SLO reconciliation.

## 9. Optimization decision and follow-up experiments

**Decision record: DEFER OPTIMIZATION.** No current measurement justifies modifying `RedisCache`, `MatchService`, the match TTL, connection settings, or Redis/Valkey memory policy.

Before proposing changes:

1. Run **multiple paired cold/warm HTTP trials** (for example, 30 or more), with explicit cache reset, consistent fixture state, warm-up, and separate median/p95 estimates.
2. Collect **application-scoped cache-hit, miss, and error counters** without including the profiler's synthetic GET probes.
3. Test **concurrent invalidation correctness**: seed a cached value, create a pending outbox entry, update the authoritative PostgreSQL record, and verify stale data is never served. Keep this strictly within the isolated test environment.
4. Measure match-detail behavior at 10 and 25 VUs with **hot-key, cold-key, and expiration-boundary** workloads.
5. Record Redis command throughput, client errors, memory pressure, and cache size under representative key counts. Where applicable, verify production `maxmemory` and eviction configuration.
6. Repeat against the intended **Valkey** deployment version if applicable.
7. Consider optimizations **only after** a repeatable bottleneck or verified safety-preserving improvement is demonstrated; use Phase 25.8.8 for before-and-after regression evidence.

## 10. Phase 25.8.4 completion record

| Substep | Description | Evidence status |
|---|---|---|
| 25.8.4.1 | Inspect Redis configuration and cache strategy | Complete |
| 25.8.4.2 | Measure Redis command latency | Complete for sampled operations |
| 25.8.4.3 | Verify cache hits, misses and TTL | Initial cache-aside behavior verified; full application hit rate outstanding |
| 25.8.4.4 | Compare cold and warm API requests | One paired observation; repeated comparison outstanding |
| 25.8.4.5 | Inspect memory and eviction statistics | Complete for isolated CI snapshot |
| 25.8.4.6 | Publish findings and optimization decision | Report prepared; commit/push to be verified separately |

**Phase disposition:** Initial evidence review completed, with deferred optimization and explicit follow-ups. This does not certify production cache performance or invalidation correctness under concurrency.

## 11. Evidence and reproducibility

- Profiling output: `server/benchmark-evidence/redis-cache-profile.json` in the GitHub Actions artifact for the run recorded at `2026-11-24T11:45:39.571Z`.
- Profiling implementation: `server/scripts/profile-redis-cache.mjs`.
- GitHub Actions workflow: `.github/workflows/rest-api-baseline.yml`, `capacity` profile on `feat/rest-api-baseline-25-8-1`.
- Related reports: `docs/performance/PHASE_25_8_1_BENCHMARK_EVIDENCE.md`, `docs/performance/PHASE_25_8_2_REST_BOTTLENECK_ANALYSIS.md`, and `docs/performance/PHASE_25_8_3_POSTGRESQL_ANALYSIS.md`.

Raw values in this report are taken from the submitted Phase 25.8.4 JSON summary; calculated ratios are labeled as descriptive, single-pair estimates.

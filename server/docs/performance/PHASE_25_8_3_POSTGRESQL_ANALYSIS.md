# CricZone Phase 25.8.3 — PostgreSQL Query and Connection Pool Analysis

**Status:** Initial evidence review complete; no database optimization approved.  
**Evidence date:** 2026-11-24  
**Environment:** Isolated GitHub-hosted runner; PostgreSQL 18.7; `criczone_test` database  
**Working branch:** `feat/rest-api-baseline-25-8-1`  
**Scope:** Read-only REST endpoints `/api/v1/matches`, `/api/v1/matches/1`, `/api/v1/matches/1/scorecard`

## Executive summary

The PostgreSQL queries measured with `EXPLAIN (ANALYZE, BUFFERS)` executed in **0.006–0.108 ms** against a very small seeded dataset. The connection sampler captured **200 snapshots** across approximately 205 seconds of endpoint-isolated load: **8–10 database connections**, at most **3 active**, and **1 snapshot with a reported active database wait**. There is no evidence of a *sustained* PostgreSQL query or server-side connection bottleneck in this CI test. There is also insufficient evidence to infer production behavior, Node.js pool acquisition latency, or saturation capacity.

**Decision:** Defer query rewrites, new indexes, and pool-size increases until tests with representative data volume and application-side pool instrumentation establish a measurable bottleneck.

## 1. Configuration and test conditions

| Setting | Observed / configured value |
|---|---|
| PostgreSQL server | 18.7 (Debian 18.7-1.pgdg13+5) |
| Database | `criczone_test` |
| Server `max_connections` | 100 |
| Node.js `pg.Pool` default `max` | 10 (unless overridden with `DB_POOL_MAX`) |
| Node.js pool idle timeout | 30,000 ms by default |
| Node.js pool connection timeout | 5,000 ms by default |
| Query statement timeout | 10,000 ms by default |
| k6 workloads | Endpoint-isolated 10 and 25 VUs, each scenario 30 seconds, with 200 ms iteration sleep |
| Connection monitoring | `pg_stat_activity` sampled about once per second |

The PostgreSQL maximum connection setting (100) is **not** the Node.js application's pool size (10 by default). The `pg_stat_activity` sampler sees server sessions; it does **not** expose `pg.Pool.waitingCount` or pool acquisition wait times.

### Seeded dataset size

| Table | Rows |
|---|---:|
| `matches` | 3 |
| `scorecards` | 1 |
| `innings` | 2 |
| `batting_performances` | 6 |
| `bowling_performances` | 4 |

These row counts strongly limit conclusions about query scaling and index effectiveness.

## 2. Query plan results

All times below are PostgreSQL **execution** times from individual `EXPLAIN (ANALYZE, BUFFERS)` statements, not full HTTP response latency, Node.js query round-trip latency, or measurements taken concurrently with the k6 load.

| Query examined | Execution time | Plan observations |
|---|---:|---|
| Matches list, joins and sort | **0.108 ms** | Hash joins and quicksort; shared buffer hits; no observed disk read |
| Pending cache-invalidation outbox lookup | **0.007 ms** | Sequential scan of empty outbox in this seed |
| Scorecard lookup by match ID | **0.006 ms** | Sequential scan of one-row table |
| Innings by scorecard ID | **0.035 ms** | Sequential scans/hash join with teams; quicksort; two innings |
| Batting performances by innings ID | **0.026 ms** | Sequential scans/hash join with players; quicksort; three selected rows |
| Bowling performances by innings ID | **0.023 ms** | Sequential scans/hash join with players; quicksort; two selected rows |

**Interpretation:** All six execution plans are inexpensive for this seed. Sequential scans are expected on tables holding one to a few rows; their presence alone is not evidence of poor indexing. The provided plans show shared buffer hits, not a meaningful disk-I/O bottleneck.

**Scope detail:** The profiling SQL uses representative statements. It does not reproduce every selected column in every production repository query, so its timings should not be presented as a complete endpoint SQL breakdown.

## 3. Index assessment

**Indexes already present**

- `scorecards_match_id_key`: unique B-tree on `scorecards(match_id)`.
- `idx_innings_scorecard_id`: B-tree on `innings(scorecard_id)`.
- `matches_pkey`, `idx_matches_start_time`, `idx_matches_status`, `idx_matches_series_id`.
- Primary-key and player-ID indexes on batting and bowling performance tables.
- `idx_cache_outbox_pending`: partial B-tree on `(created_at, id)` where `status = 'PENDING'`.

**Candidates to evaluate with more realistic row counts**

1. There is no dedicated index on `batting_performances(innings_id)` or `bowling_performances(innings_id)` in the captured schema. These may become useful as rows grow, but the current plans do not justify adding them.
2. The invalidation read checks `match_id = ? AND status <> 'COMPLETED'`. The existing outbox partial index only covers `status = 'PENDING'` and is keyed on `(created_at, id)`. It is not a direct match for that lookup, particularly if `PROCESSING` rows accumulate. Verify actual cardinality and predicate distribution before proposing an index keyed on `match_id`.
3. Existing indexes are not necessarily chosen for one-row and two-row tables; this is normal planner behavior.

**Decision:** No index changes in Phase 25.8.3 based solely on the current seed.

## 4. PostgreSQL connection and wait observations

Data source: `postgresql-connections.csv`, **200** samples collected during the six-scenario benchmark.

| Observation | Result |
|---|---:|
| Samples | 200 |
| Total server-side client connections (sampled) | 8–10 |
| Samples with 10 total connections | 189 |
| Maximum active connections | 3 |
| Samples with 0 active connections | 194 |
| Maximum idle connections | 10 |
| Samples with a reported active wait | 1 |
| Samples with no reported active wait | 199 |
| Maximum simultaneous active sessions with a wait event | 1 |

Observed active connection sample distribution:

| Active connections | Samples |
|---:|---:|
| 0 | 194 |
| 1 | 2 |
| 2 | 3 |
| 3 | 1 |

The backend's default pool maximum is 10. No sustained database-side contention is visible in these one-second snapshots. The high idle share is consistent with a short-query workload paced by a 200 ms sleep; however, brief connection spikes or waiting between samples might be missed.

The monitoring query counts *active sessions with a PostgreSQL wait event*, not queued application callers. A server-side wait event may also reflect activity other than connection-pool exhaustion. Accordingly, the evidence **does not prove** that Node.js `pg.Pool` experienced zero wait time.

## 5. Relationship to Phase 25.8.2 REST performance

The preceding endpoint-isolated benchmark reported **15,540 successful HTTP requests**, **31,080/31,080 checks passed**, and **zero reported HTTP 429 or 5xx responses**, across the six 10- and 25-VU scenarios. Its overall p95 latency was approximately **5.17 ms**. Endpoint p95 at 25 VUs was **5.03 ms (matches)**, **6.37 ms (match detail)**, and **5.37 ms (scorecard)**.

These are HTTP results and must not be equated with PostgreSQL execution times. End-to-end latency can also include pool acquisition, network round trips to Postgres or Redis, serialization, Express middleware, cache consistency checks, and scheduling.

The relatively higher match-detail p95 under concurrency suggests a possible application path worth instrumenting. This is a **hypothesis**, not evidence that the database is the cause.

## 6. Limitations and follow-up measurements

- **Dataset scale:** Just 3 matches, 1 scorecard, 2 innings, 6 batting and 4 bowling performance rows; not representative of larger or production data.
- **Execution-plan mode:** Isolated, single-statement plans outside the concurrency window; plans may change with data size and statistics.
- **Sampling granularity:** One-second PostgreSQL snapshots can miss brief active/wait bursts.
- **Pool queues:** `pg_stat_activity` does not measure `pg.Pool.totalCount`, `idleCount`, `waitingCount`, or the duration spent awaiting pool acquisition.
- **Cache effects:** A warm match-detail cache changes how often PostgreSQL is queried; cache hit/miss rates were not isolated here.
- **Write activity:** Workloads are read-only and do not establish lock/contention behavior for live ball ingestion or writes.
- **Production comparability:** Isolated CI localhost timing is not a production capacity or user-perceived latency result.

For any later pool saturation claim, instrument and export `pg.Pool.totalCount`, `idleCount`, `waitingCount` and acquisition-wait distributions, then repeat load at representative concurrency. For indexing decisions, replay representative production-scale **synthetic** data and compare query plans and p95 end-to-end latencies before and after changes.

## 7. Optimization decision and handoff

**Finding:** No confirmed PostgreSQL bottleneck within the measured CI conditions.

**Action:** **Defer** additional indexes, SQL rewrites, and `DB_POOL_MAX` increases. Do not remove the existing consistency/invalidation checks to reduce query counts without a separate correctness analysis. Preserve the captured query plans, connection CSV and REST benchmark results as the Phase 25.8.3 baseline.

**Optimization candidates for later evidence-based evaluation:**

1. Missing innings-ID performance indexes under larger data volume.
2. Outbox lookup predicate/index alignment when the outbox is populated.
3. Scorecard query fan-out and application round trips.
4. Match-detail cache invalidation checking and pool acquisition time.

**Next phase:** **25.8.4 — Redis/Valkey latency and cache effectiveness.**

## 8. Evidence and completion checklist

| Phase step | Status | Supporting evidence |
|---|---|---|
| 25.8.3.1 Verify pool configuration | Complete, configured state | `database.config.js`; `PostgresDatabaseClient.js`; SQL server setting |
| 25.8.3.2 Collect `EXPLAIN ANALYZE` | Complete | `postgresql-query-profile.txt` |
| 25.8.3.3 Capture connection usage under load | Complete, server-side only | `postgresql-connections.csv` |
| 25.8.3.4 Analyze index effectiveness | Complete for current seed | SQL plans and `pg_indexes` inventory |
| 25.8.3.5 Identify query/pool bottlenecks | Initial diagnosis complete | No sustained bottleneck observed; limitations documented |
| 25.8.3.6 Publish findings | This report; mark complete after committed to branch | `docs/performance/PHASE_25_8_3_POSTGRESQL_ANALYSIS.md` |

**Evidence artifacts:** `benchmark-evidence/postgresql-query-profile.txt`, `benchmark-evidence/postgresql-connections.csv`, `rest-api-baseline-results.json`, and `rest-api-bottlenecks-results.json` in the GitHub Actions artifact for the corresponding run.

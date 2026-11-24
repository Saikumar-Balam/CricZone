# CricZone Phase 25.8.1 — Benchmark Evidence Collection and Validation

**Status:** Representative REST baseline, limiter stress observation, and isolated capacity benchmark validated for the tested workloads; final Phase 25.1 SLO reconciliation and full historical artifact provenance remain open.  
**Evidence window:** 2026-11-23 to 2026-11-24  
**Target:** Isolated GitHub-hosted runner, `http://127.0.0.1:3000`  
**Branch used for benchmark development:** `feat/rest-api-baseline-25-8-1`  
**Scope:** `GET /api/v1/matches`, `GET /api/v1/matches/1`, `GET /api/v1/matches/1/scorecard`

## Executive summary

The representative 1-VU baseline passed all response checks with zero HTTP failures. A subsequent 10-VU stress test encountered 1,383 HTTP 429 responses from a global per-IP rate limiter and failed the success thresholds. A deliberately isolated, CI-only capacity configuration retained application behavior but raised the rate-limit allowance. Multiple 10-VU capacity runs then passed all checks and returned zero HTTP 429 or 5xx responses. These runs establish reliable behavior at approximately **49 successful requests per second with 200 ms pacing**, not maximum system throughput. The latest provided capacity run recorded 1,480 successful requests and overall p95 **5.472 ms**.

The **2,000 ms endpoint p95 threshold** is a provisional k6 test guard, **not an approved Phase 25.1 production SLO**. Production-scale acceptance remains open.

## 1. Benchmark configuration and instrumentation

| Property | Value |
|---|---|
| Runner | GitHub Actions, isolated Linux runner |
| Server target | Local Express service `127.0.0.1:3000` |
| Backend test services | PostgreSQL, Redis, Kafka on CI runner |
| Dataset | Seeded test cricket data; match ID `1` |
| Baseline | 1 virtual user (VU), 60 s, 1 s sleep per iteration |
| Stress | 10 VUs, 30 s, 0.2 s sleep, normal rate limit |
| Capacity | 10 VUs, 30 s, 0.2 s sleep, CI-only raised rate-limit allowance |
| Normal REST limit | 100 requests per 60 s per client IP |
| Capacity REST limit | Configured as 10,000 requests per 60 s per client IP for explicitly gated CI test only |
| Validation | HTTP 200 and `success: true` with non-null `data` |
| Failure guard | k6 HTTP failure rate below 1%; checks above 99% |
| Endpoint latency guard | p95 below 2,000 ms, provisional |

The CI-only override must remain restricted to `NODE_ENV=test`, `GITHUB_ACTIONS=true`, `PROFILE=capacity`, and `CRICZONE_CI_CAPACITY_TEST=true`. It must not affect normal or production rate limiting.

## 2. Representative low-load REST baseline

**Recorded:** 2026-11-23 19:39:03 UTC.  
**Profile:** `baseline`, 1 VU, 60 s, 1 s pacing.

| Measurement | Observed |
|---|---:|
| Requests | 60 |
| Throughput | 0.996 req/s |
| HTTP failure rate | 0% |
| Response checks | 120 passed / 120 total |
| Overall average | 2.915 ms |
| Overall p95 | 3.763 ms |
| Maximum | 9.769 ms |

| Endpoint | Average (ms) | p95 (ms) | Maximum (ms) |
|---|---:|---:|---:|
| Matches list | 2.431 | 3.133 | 3.532 |
| Match detail | 2.704 | 3.379 | 4.256 |
| Scorecard | 3.610 | 4.432 | 9.769 |

All three endpoint p95 guards passed. The baseline confirms correctness under light load and gives a reference measurement, but says little about capacity or saturation.

## 3. Normal-rate-limit stress test: diagnostic failure

**Recorded:** 2026-11-23 19:44:26 UTC.  
**Profile:** `stress`, 10 VUs, 30 s, 0.2 s pacing.

| Measurement | Observed |
|---|---:|
| HTTP requests | 1,490 |
| Attempt rate | 49.47 req/s |
| HTTP 429 responses | 1,383 (92.82%) |
| Remaining HTTP requests | 107 (7.18%) |
| Check results | 214 passed, 2,766 failed; 7.18% pass rate |
| HTTP failure rate | 92.82% |
| k6 exit status | 99; threshold failures for `checks`, `http_req_failed` |
| All-request p95 latency | 3.980 ms, **not a valid successful-API latency comparator** |

This is consistent with rate-limit enforcement: concurrent VUs use the same loopback source IP and therefore share one per-IP bucket. The 1,383 recorded HTTP 429 responses account for the failed HTTP requests and invalid cricket payload counters. This run must **not** be classified as a backend saturation failure or counted as 1,490 successful API responses. The count of 107 allowed requests does not independently establish the precise limiter window boundary.

## 4. Successful CI-only capacity benchmarks

All listed capacity runs used 10 VUs, 30 s, and 0.2 s iteration pacing. Each had **zero HTTP 429, zero 5xx, zero failed checks and zero invalid responses**.

| Run timestamp (UTC) | Requests | Requests/s | Overall p95 (ms) | Overall mean (ms) | Checks |
|---|---:|---:|---:|---:|---|
| 2026-11-23 20:09:07 | 1,480 | 49.087 | 5.643 | 3.054 | 2,960 / 2,960 |
| 2026-11-24 08:24:32 | 1,490 | 49.375 | 2.840 | 1.736 | 2,980 / 2,980 |
| 2026-11-24 10:00:20 | 1,480 | 49.025 | 5.712 | 3.211 | 2,960 / 2,960 |
| 2026-11-24 10:47:31 | 1,480 | 49.152 | 5.472 | 2.795 | 2,960 / 2,960 |

### Latest provided capacity run (2026-11-24 10:47:31 UTC)

| Endpoint | Average (ms) | p95 (ms) | Maximum (ms) |
|---|---:|---:|---:|
| Matches list | 2.228 | 3.480 | 30.705 |
| Match detail | 2.725 | 5.838 | 31.657 |
| Scorecard | 3.433 | 5.884 | 30.405 |
| **Overall** | **2.795** | **5.472** | **31.657** |

The repeat-run p95 variation (2.840–5.712 ms) is a range of individual **run-level p95 values**, not a combined percentile. Runner conditions, background activity and cache warmness were not fully controlled; do not claim these differences result from optimizations.

## 5. Historical non-REST evidence inventory

An earlier reconstructed evidence package, `CricZone_25_8_1_Baseline.md` and its paired JSON, covers historical GitHub Actions results for health-only REST smoke, PostgreSQL, Valkey, Kafka and WebSocket. That reconstruction reported successful selected workflows but unavailable historic artifact ZIPs, so historical values are **log-derived** and must be distinguished from newly captured representative REST JSON.

| Component | Historical workflow run | Qualification |
|---|---|---|
| REST health smoke | [37949501499](https://github.com/Saikumar-Balam/CricZone/actions/runs/37949501499) | `/health` only, not representative cricket REST |
| PostgreSQL | [38032704487](https://github.com/Saikumar-Balam/CricZone/actions/runs/38032704487) | Remote database and different workload; not comparable with localhost REST |
| Valkey | [38059680290](https://github.com/Saikumar-Balam/CricZone/actions/runs/38059680290) | 18 workload executions reconstructed from logs |
| Kafka | [38066131504](https://github.com/Saikumar-Balam/CricZone/actions/runs/38066131504) | 21 workload executions reconstructed from logs |
| WebSocket | [38080763640](https://github.com/Saikumar-Balam/CricZone/actions/runs/38080763640) | 30 scenarios/repetitions reconstructed from logs |

The historical Redis/Valkey, Kafka and WebSocket suites will receive targeted interpretation during Phases 25.8.4–25.8.6. Their throughput numbers should not be directly compared to REST HTTP request rates.

## 6. Verification and limitations

**Verified for the supplied runs**

- Real match list, match detail and scorecard REST endpoints returned valid cricket API responses under low and 10-VU capacity loads.
- All provisional endpoint p95 guards passed in successful baseline and capacity runs.
- Default rate limiting was exercised under normal stress conditions and returned 429 responses.
- Raising rate limits only for explicitly isolated CI capacity testing eliminated observed 429 responses in the supplied capacity runs.
- Benchmark JSON outputs contain timestamps, workload parameters, error rates, latency distributions and validation checks.

**Not yet established**

- Maximum sustainable request throughput, knee point or saturation limit; pacing restricts offered load.
- Performance on production-sized data, real networks or production hardware.
- Acceptance against authoritative Phase 25.1 SLOs; the 2,000 ms guard is provisional.
- Provenance completeness for older, missing historical artifact archives and prior failed attempts.
- Repeated-run statistical confidence intervals, synchronized CPU/memory utilization or full cache-state controls.

## 7. Decision and handoff

**Decision:** Retain the successful capacity outputs as the **before-optimization evidence** for read-only cricket REST calls. Preserve the rate-limit stress failure as a separate, informative rate-limiter test rather than altering normal security controls. Do not declare production performance acceptance.

**Handoff:** Phase 25.8.2 compares endpoint-isolated load at 10 and 25 VUs. Phase 25.8.3 examines PostgreSQL queries and pools. Subsequent infrastructure analyses should reference the same workload/runner provenance and capture report artifacts.

**Closure:** Phase 25.8.1's representative REST benchmarking is complete **for the tested CI scope**. Overall baseline evidence acceptance remains qualified pending Phase 25.1 SLO reconciliation and complete historical provenance review.

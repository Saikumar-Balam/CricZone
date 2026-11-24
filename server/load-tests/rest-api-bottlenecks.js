
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '');
const matchId = __ENV.MATCH_ID || '1';

if (
  __ENV.PROFILE !== 'capacity' ||
  __ENV.ISOLATED_TEST_ENV !== 'true' ||
  __ENV.CRICZONE_CI_CAPACITY_TEST !== 'true' ||
  __ENV.GITHUB_ACTIONS !== 'true'
) {
  throw new Error('CI capacity environment is required');
}

if (
  !/^http:\/\/(127\.0\.0\.1|localhost):3000$/.test(baseUrl)
) {
  throw new Error('Only the isolated local backend is allowed');
}

if (!/^[1-9]\d*$/.test(matchId)) {
  throw new Error('MATCH_ID must be a positive integer');
}

const endpoints = {
  matches: '/api/v1/matches',
  match_detail: `/api/v1/matches/${matchId}`,
  scorecard: `/api/v1/matches/${matchId}/scorecard`
};

const failures429 = new Counter('criczone_bottleneck_429');
const failures5xx = new Counter('criczone_bottleneck_5xx');

const definitions = [
  ['matches_10', 10, '0s'],
  ['match_detail_10', 10, '35s'],
  ['scorecard_10', 10, '70s'],
  ['matches_25', 25, '105s'],
  ['match_detail_25', 25, '140s'],
  ['scorecard_25', 25, '175s']
];

const scenarios = {};

for (const [name, vus, startTime] of definitions) {
  scenarios[name] = {
    executor: 'constant-vus',
    exec: 'runEndpoint',
    vus,
    duration: '30s',
    startTime,
    gracefulStop: '5s',
    env: {
      ENDPOINT_NAME: name.replace(/_\d+$/, '')
    }
  };
}

export const options = {
  scenarios,
  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01']
  }
};

export function runEndpoint() {
  const name = __ENV.ENDPOINT_NAME;
  const path = endpoints[name];

  if (!path) {
    throw new Error(`Unknown endpoint: ${name}`);
  }

  const response = http.get(`${baseUrl}${path}`, {
    timeout: '10s',
    tags: {
      endpoint: name
    },
    headers: {
      Accept: 'application/json'
    }
  });

  if (response.status === 429) {
    failures429.add(1);
  }

  if (response.status >= 500) {
    failures5xx.add(1);
  }

  let valid = false;

  if (response.status === 200) {
    try {
      const payload = response.json();

      valid =
        payload !== null &&
        typeof payload === 'object' &&
        payload.success === true &&
        payload.data !== null &&
        payload.data !== undefined;
    } catch (_) {
      valid = false;
    }
  }

  check(response, {
    'HTTP 200': (r) => r.status === 200,
    'valid API response': () => valid
  });

  sleep(0.2);
}

export function handleSummary(data) {
  const metrics = data.metrics || {};
  const results = [];

  for (const [name, vus] of definitions) {
    const latency =
      metrics[`http_req_duration{scenario:${name}}`]?.values || {};

    const requests =
      metrics[`http_reqs{scenario:${name}}`]?.values || {};

    results.push({
      scenario: name,
      vus,
      endpoint: name.replace(/_\d+$/, ''),
      requests: requests.count ?? null,
      requests_per_second: requests.rate ?? null,
      avg_ms: latency.avg ?? null,
      p90_ms: latency['p(90)'] ?? null,
      p95_ms: latency['p(95)'] ?? null,
      max_ms: latency.max ?? null
    });
  }

  const summary = {
    phase: '25.8.2',
    tested_at: new Date().toISOString(),
    profile: 'capacity',
    target: 'isolated-github-hosted-runner',
    test_type: 'endpoint-isolated',
    duration_per_scenario: '30s',
    results,
    http_429_count:
      metrics.criczone_bottleneck_429?.values?.count ?? 0,
    http_5xx_count:
      metrics.criczone_bottleneck_5xx?.values?.count ?? 0,
    http_failure_rate:
      metrics.http_req_failed?.values?.rate ?? null,
    checks_pass_rate:
      metrics.checks?.values?.rate ?? null,
    metrics
  };

  return {
    'rest-api-bottlenecks-results.json':
      JSON.stringify(summary, null, 2),
    stdout: JSON.stringify({
      phase: summary.phase,
      results,
      http_429_count: summary.http_429_count,
      http_5xx_count: summary.http_5xx_count,
      http_failure_rate: summary.http_failure_rate,
      checks_pass_rate: summary.checks_pass_rate
    }, null, 2) + '\n'
  };
}

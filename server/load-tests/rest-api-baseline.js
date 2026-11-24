
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '');
const matchId = __ENV.MATCH_ID || '1';
const profile = __ENV.PROFILE || 'baseline';

const allowedProfiles = [
  'baseline',
  'stress',
  'capacity'
];

if (!/^https?:\/\//.test(baseUrl)) {
  throw new Error('BASE_URL must be a valid HTTP(S) URL');
}

if (!/^[1-9]\d*$/.test(matchId)) {
  throw new Error('MATCH_ID must be a positive integer');
}

if (!allowedProfiles.includes(profile)) {
  throw new Error(
    'PROFILE must be baseline, stress, or capacity'
  );
}

if (__ENV.ISOLATED_TEST_ENV !== 'true') {
  throw new Error(
    'ISOLATED_TEST_ENV=true is required'
  );
}

if (
  profile === 'capacity' &&
  __ENV.CRICZONE_CI_CAPACITY_TEST !== 'true'
) {
  throw new Error(
    'Capacity profile requires CRICZONE_CI_CAPACITY_TEST=true'
  );
}

if (
  profile === 'capacity' &&
  !/^http:\/\/(127\.0\.0\.1|localhost):3000$/.test(baseUrl)
) {
  throw new Error(
    'Capacity profile must target the isolated localhost:3000 API'
  );
}

const profileSettings = {
  baseline: {
    vus: 1,
    duration: '60s',
    sleepSeconds: 1
  },

  stress: {
    vus: 10,
    duration: '30s',
    sleepSeconds: 0.2
  },

  capacity: {
    vus: 10,
    duration: '30s',
    sleepSeconds: 0.2
  }
};

const workload = profileSettings[profile];

const targets = [
  {
    name: 'matches',
    path: '/api/v1/matches'
  },
  {
    name: 'match_detail',
    path: `/api/v1/matches/${matchId}`
  },
  {
    name: 'scorecard',
    path: `/api/v1/matches/${matchId}/scorecard`
  }
];

const response429 = new Counter('criczone_http_429');
const response5xx = new Counter('criczone_http_5xx');
const invalidResponse = new Counter('criczone_invalid_response');

export const options = {
  scenarios: {
    cricket_rest: {
      executor: 'constant-vus',
      vus: workload.vus,
      duration: workload.duration,
      gracefulStop: '30s'
    }
  },

  thresholds: {
    checks: ['rate>0.99'],
    http_req_failed: ['rate<0.01'],

    'http_req_duration{endpoint:matches}': [
      'p(95)<2000'
    ],

    'http_req_duration{endpoint:match_detail}': [
      'p(95)<2000'
    ],

    'http_req_duration{endpoint:scorecard}': [
      'p(95)<2000'
    ]
  }
};

export default function () {
  const target = targets[
    (__VU + __ITER - 1) % targets.length
  ];

  const response = http.get(
    `${baseUrl}${target.path}`,
    {
      timeout: '10s',
      tags: {
        endpoint: target.name
      },
      headers: {
        Accept: 'application/json'
      }
    }
  );

  if (response.status === 429) {
    response429.add(1, {
      endpoint: target.name
    });
  }

  if (response.status >= 500) {
    response5xx.add(1, {
      endpoint: target.name
    });
  }

  let valid = false;

  if (response.status === 200) {
    try {
      const payload = response.json();

      valid =
        payload !== null &&
        typeof payload === 'object' &&
        payload.success === true &&
        payload.data !== undefined &&
        payload.data !== null;
    } catch (_) {
      valid = false;
    }
  }

  if (!valid) {
    invalidResponse.add(1, {
      endpoint: target.name
    });
  }

  check(
    response,
    {
      'HTTP 200': (res) => res.status === 200,
      'valid cricket API payload': () => valid
    },
    {
      endpoint: target.name
    }
  );

  sleep(workload.sleepSeconds);
}

export function handleSummary(data) {
  const metrics = data.metrics || {};

  const totalRequests =
    metrics.http_reqs?.values?.count ?? 0;

  const requestRate =
    metrics.http_reqs?.values?.rate ?? 0;

  const errorRate =
    metrics.http_req_failed?.values?.rate ?? 0;

  const response429Count =
    metrics.criczone_http_429?.values?.count ?? 0;

  const response5xxCount =
    metrics.criczone_http_5xx?.values?.count ?? 0;

  const invalidResponseCount =
    metrics.criczone_invalid_response?.values?.count ?? 0;

  const overallLatency =
    metrics.http_req_duration?.values || {};

  const endpointLatency = {};

  for (const target of targets) {
    const metricName =
      `http_req_duration{endpoint:${target.name}}`;

    endpointLatency[target.name] = {
      path: target.path,
      avg_ms:
        metrics[metricName]?.values?.avg ?? null,
      median_ms:
        metrics[metricName]?.values?.med ?? null,
      p90_ms:
        metrics[metricName]?.values?.['p(90)'] ?? null,
      p95_ms:
        metrics[metricName]?.values?.['p(95)'] ?? null,
      max_ms:
        metrics[metricName]?.values?.max ?? null
    };
  }

  const summary = {
    phase: '25.8.1',
    scenario: 'cricket-rest-baseline',
    profile,
    tested_at: new Date().toISOString(),
    target: 'isolated-github-hosted-runner',
    base_url: baseUrl,
    match_id: matchId,

    workload: {
      virtual_users: workload.vus,
      duration: workload.duration,
      sleep_seconds: workload.sleepSeconds
    },

    rate_limit_mode:
      profile === 'capacity'
        ? 'CI-only increased limit (10000/min/IP)'
        : 'default limit (100/min/IP)',

    endpoint_paths: targets.map(
      (target) => target.path
    ),

    results: {
      total_requests: totalRequests,
      requests_per_second: requestRate,
      http_failure_rate: errorRate,
      http_429_count: response429Count,
      http_5xx_count: response5xxCount,
      invalid_response_count: invalidResponseCount,

      overall_latency_ms: {
        average: overallLatency.avg ?? null,
        median: overallLatency.med ?? null,
        p90: overallLatency['p(90)'] ?? null,
        p95: overallLatency['p(95)'] ?? null,
        max: overallLatency.max ?? null
      },

      endpoint_latency_ms: endpointLatency
    },

    note:
      'The 2000ms latency thresholds are provisional. ' +
      'Final SLO acceptance requires Phase 25.1 reconciliation.',

    metrics
  };

  return {
    'rest-api-baseline-results.json':
      JSON.stringify(summary, null, 2),

    stdout:
      JSON.stringify(
        {
          test: 'cricket-rest-baseline',
          phase: '25.8.1',
          profile,
          virtual_users: workload.vus,
          duration: workload.duration,
          total_requests: totalRequests,
          requests_per_second: requestRate,
          http_429_count: response429Count,
          http_5xx_count: response5xxCount,
          http_failure_rate: errorRate,
          overall_p95_ms:
            overallLatency['p(95)'] ?? null,
          summary_file:
            'rest-api-baseline-results.json'
        },
        null,
        2
      ) + '\n'
  };
}

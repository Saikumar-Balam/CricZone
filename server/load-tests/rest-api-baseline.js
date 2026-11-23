
// CricZone Phase 25.8.1 REST API Benchmark
// Execute only against isolated test infrastructure.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '');
const matchId = __ENV.MATCH_ID || '1';
const profile = __ENV.PROFILE || 'baseline';

if (!/^https?:\/\//.test(baseUrl)) {
  throw new Error('BASE_URL must be an HTTP(S) URL');
}

if (!/^[1-9]\d*$/.test(matchId)) {
  throw new Error('MATCH_ID must be a positive integer');
}

if (!['baseline', 'stress'].includes(profile)) {
  throw new Error('PROFILE must be baseline or stress');
}

if (__ENV.ISOLATED_TEST_ENV !== 'true') {
  throw new Error('ISOLATED_TEST_ENV=true is required');
}

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
      vus: profile === 'baseline' ? 1 : 10,
      duration: profile === 'baseline' ? '60s' : '30s'
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
  // Rotate through all three endpoints.
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
        payload &&
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
      'HTTP 200': (r) => r.status === 200,
      'valid cricket API payload': () => valid
    },
    {
      endpoint: target.name
    }
  );

  sleep(profile === 'baseline' ? 1 : 0.2);
}

export function handleSummary(data) {
  const summary = {
    phase: '25.8.1',
    profile,
    tested_at: new Date().toISOString(),
    match_id: matchId,
    target: 'isolated-github-hosted-runner',

    note:
      '2000ms is a provisional test guard, not a Phase 25.1 acceptance SLO.',

    endpoint_paths: targets.map(
      (target) => target.path
    ),

    metrics: data.metrics
  };

  return {
    'rest-api-baseline-results.json':
      JSON.stringify(summary, null, 2),

    stdout:
      `CricZone REST ${profile} benchmark completed. ` +
      'Results saved to rest-api-baseline-results.json\n'
  };
}

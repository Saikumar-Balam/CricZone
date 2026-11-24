
import { io } from 'socket.io-client';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';

const required = {
  NODE_ENV: 'test',
  GITHUB_ACTIONS: 'true',
  ISOLATED_TEST_ENV: 'true',
  PROFILE: 'capacity',
  CRICZONE_CI_CAPACITY_TEST: 'true'
};

for (const [name, value] of Object.entries(required)) {
  if (process.env[name] !== value) {
    throw new Error(`Required ${name}=${value}`);
  }
}

const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
const matchId = process.env.MATCH_ID || '1';

if (!/^http:\/\/(localhost|127\.0\.0\.1):3000$/.test(baseUrl)) {
  throw new Error('Only isolated localhost:3000 is allowed');
}

if (!/^[1-9]\d*$/.test(matchId)) {
  throw new Error('Invalid MATCH_ID');
}

const cohorts = [10, 25, 50];
const room = `match:${matchId}`;

function summarize(values) {
  if (!values.length) {
    return {
      count: 0,
      average_ms: null,
      p50_ms: null,
      p95_ms: null,
      p99_ms: null,
      max_ms: null
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  const percentile = (p) => {
    const index = Math.max(
      0,
      Math.ceil((p / 100) * sorted.length) - 1
    );

    return sorted[index];
  };

  return {
    count: sorted.length,
    average_ms:
      sorted.reduce((sum, value) => sum + value, 0) /
      sorted.length,
    p50_ms: percentile(50),
    p95_ms: percentile(95),
    p99_ms: percentile(99),
    max_ms: sorted.at(-1)
  };
}

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function getMetrics() {
  const response = await fetch(`${baseUrl}/metrics`, {
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(`Metrics returned HTTP ${response.status}`);
  }

  return response.text();
}


function getMetric(text, name) {
  const lines = text.split('\n');
  let total = 0;
  let found = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (
      !trimmed.startsWith(`${name} `) &&
      !trimmed.startsWith(`${name}{`)
    ) {
      continue;
    }

    const match = trimmed.match(
      /^(?:[a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{.*\})?\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)$/
    );

    if (!match) {
      throw new Error(
        `Unable to parse Prometheus metric: ${trimmed}`
      );
    }

    const value = Number(match[1]);

    if (!Number.isFinite(value)) {
      throw new Error(`Invalid metric value: ${trimmed}`);
    }

    total += value;
    found = true;
  }

  return found ? total : null;
}


function connectClient() {
  const start = performance.now();

  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      autoConnect: false,
      timeout: 10000
    });

    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;

      settled = true;
      socket.disconnect();
      reject(new Error('WebSocket connection timed out'));
    }, 12000);

    socket.once('connect', () => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);

      resolve({
        socket,
        connection_ms: performance.now() - start
      });
    });

    socket.once('connect_error', (error) => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);
      socket.disconnect();
      reject(error);
    });

    socket.connect();
  });
}

async function disconnectClients(clients) {
  for (const client of clients) {
    client.socket.disconnect();
  }

  await delay(300);
}

async function runCohort(count) {
  const before = await getMetrics();

  const beforeConnections = getMetric(
    before,
    'websocket_connections_total'
  );

  const beforeJoins = getMetric(
    before,
    'websocket_room_joins_total'
  );

  const beforeLeaves = getMetric(
    before,
    'websocket_room_leaves_total'
  );

  const beforeDisconnects = getMetric(
    before,
    'websocket_disconnections_total'
  );

  const clients = [];
  const failures = [];

  const startedAt = performance.now();

  try {
    const results = await Promise.allSettled(
      Array.from({ length: count }, () => connectClient())
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        clients.push(result.value);
      } else {
        failures.push(result.reason.message);
      }
    }

    const connectionDuration =
      performance.now() - startedAt;

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} connection(s) failed: ${failures[0]}`
      );
    }

    for (const client of clients) {
      client.socket.emit('join-match', matchId);
    }

    await delay(500);

    const during = await getMetrics();

    const connectionDelta =
      getMetric(during, 'websocket_connections_total') -
      beforeConnections;

    const joinDelta =
      getMetric(during, 'websocket_room_joins_total') -
      beforeJoins;

    if (connectionDelta !== count) {
      throw new Error(
        `Expected ${count} connections, observed ${connectionDelta}`
      );
    }

    if (joinDelta !== count) {
      throw new Error(
        `Expected ${count} room joins, observed ${joinDelta}`
      );
    }

    const activeGauge = getMetric(
      during,
      'websocket_connected_clients'
    );

    const connectionLatency = summarize(
      clients.map((client) => client.connection_ms)
    );

    for (const client of clients) {
      client.socket.emit('leave-match', matchId);
    }

    await delay(500);

    const afterLeave = await getMetrics();

    const leaveDelta =
      getMetric(afterLeave, 'websocket_room_leaves_total') -
      beforeLeaves;

    if (leaveDelta !== count) {
      throw new Error(
        `Expected ${count} room leaves, observed ${leaveDelta}`
      );
    }

    await disconnectClients(clients);
    clients.length = 0;

    const after = await getMetrics();

    const afterDisconnects = getMetric(
      after,
      'websocket_disconnections_total'
    );

    if (afterDisconnects === null) {
      throw new Error(
        'WebSocket disconnection metric was not exported'
      );
    }


    const disconnectDelta =
  afterDisconnects - (beforeDisconnects ?? 0);

    if (disconnectDelta !== count) {
      throw new Error(
        `Expected ${count} disconnections, observed ${disconnectDelta}`
      );
    }

    return {
      concurrent_clients: count,
      attempted_connections: count,
      successful_connections: count,
      failed_connections: 0,
      connection_success_rate: 1,
      connection_establishment_duration_ms: connectionDuration,
      connection_latency: connectionLatency,
      room,
      room_joins_verified: joinDelta,
      room_leaves_verified: leaveDelta,
      disconnections_verified: disconnectDelta,
      active_connection_gauge_sample: activeGauge,
      errors: []
    };
  } finally {
    await disconnectClients(clients);
  }
}

async function main() {
  const results = [];

  for (const count of cohorts) {
    console.log(`Testing ${count} concurrent WebSocket clients`);

    const result = await runCohort(count);
    results.push(result);

    console.log(JSON.stringify(result, null, 2));

    await delay(1000);
  }

  const report = {
    phase: '25.8.6',
    tested_at: new Date().toISOString(),
    target: 'isolated-github-hosted-runner',
    test_type: 'socketio-connection-and-room-lifecycle',
    base_url: baseUrl,
    transport: 'websocket',
    match_id: matchId,
    tested_concurrency: cohorts,
    results,
    total_connection_attempts: cohorts.reduce(
      (sum, value) => sum + value,
      0
    ),
    successful_connection_attempts: results.reduce(
      (sum, result) => sum + result.successful_connections,
      0
    ),
    limitations: [
      'The test uses one backend instance',
      'Concurrency cohorts are sequential',
      'Room joins and leaves are verified using server counters',
      'No BALL_RECORDED delivery latency was measured',
      'No reconnect recovery or Redis adapter failover was tested',
      'Client connection success does not establish sustained capacity',
      'The test runs on a GitHub-hosted runner'
    ]
  };

  await mkdir('benchmark-evidence', {
    recursive: true
  });

  await writeFile(
    'benchmark-evidence/websocket-profile.json',
    JSON.stringify(report, null, 2) + '\n'
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

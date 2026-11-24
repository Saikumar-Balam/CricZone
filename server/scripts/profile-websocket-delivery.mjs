
import { io } from 'socket.io-client';
import { Kafka, logLevel } from 'kafkajs';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';

const required = {
  NODE_ENV: 'test',
  GITHUB_ACTIONS: 'true',
  ISOLATED_TEST_ENV: 'true',
  PROFILE: 'capacity',
  CRICZONE_CI_CAPACITY_TEST: 'true'
};

for (const [key, value] of Object.entries(required)) {
  if (process.env[key] !== value) {
    throw new Error(`Require ${key}=${value}`);
  }
}

const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
const kafkaBrokers = process.env.KAFKA_BROKERS;
const databaseUrl = process.env.TEST_DATABASE_URL;

if (
  !/^http:\/\/(localhost|127\.0\.0\.1):3000$/.test(baseUrl) ||
  !/^(localhost|127\.0\.0\.1):9092$/.test(kafkaBrokers || '') ||
  !/^postgres(?:ql)?:\/\/[^@/]+@(localhost|127\.0\.0\.1):5432\/criczone_test$/.test(databaseUrl || '')
) {
  throw new Error(
    'Isolated localhost app/Kafka/CI PostgreSQL only'
  );
}

if (process.env.MATCH_ID !== '1') {
  throw new Error(
    'Requires isolated seeded MATCH_ID=1'
  );
}

const topic = 'criczone.live.ball-events';
const cohorts = [10, 25, 50];
const timeoutMs = 20000;

const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const kafka = new Kafka({
  clientId: `criczone-websocket-proof-${process.env.GITHUB_RUN_ID || process.pid}`,
  brokers: [kafkaBrokers],
  logLevel: logLevel.ERROR
});

const producer = kafka.producer();

const db = new Client({
  connectionString: databaseUrl
});

const clients = new Set();

let ballNumber = 0;

function metricValue(metrics, name) {
  const values = metrics
    .split('\n')
    .filter(
      (line) =>
        line.startsWith(name + ' ') ||
        line.startsWith(name + '{')
    );

  if (!values.length) return 0;

  return values.reduce((sum, line) => {
    const value = Number(
      line.trim().split(/\s+/).at(-1)
    );

    if (!Number.isFinite(value)) {
      throw new Error(
        `Invalid ${name} metric: ${line}`
      );
    }

    return sum + value;
  }, 0);
}

async function metric(name) {
  const response = await fetch(`${baseUrl}/metrics`, {
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    throw new Error(
      `/metrics HTTP ${response.status}`
    );
  }

  return metricValue(await response.text(), name);
}

async function until(condition, description, timeout = timeoutMs) {
  const deadline = performance.now() + timeout;

  while (performance.now() < deadline) {
    if (await condition()) return;

    await delay(25);
  }

  throw new Error(
    `Timed out: ${description}`
  );
}

async function connectClient(id, history = new Map()) {
  const socket = io(baseUrl, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    autoConnect: false,
    timeout: 10000
  });

  const client = {
    id,
    socket,
    history
  };

  socket.on('BALL_RECORDED', (message) => {
    if (
      Number(message?.matchId) !== 1 ||
      Number(message?.inningsId) !== 1
    ) {
      return;
    }

    const key = Number(
      message?.lastDelivery?.ballNumber
    );

    if (!Number.isInteger(key)) return;

    const existing = history.get(key) || [];

    existing.push(performance.now());

    history.set(key, existing);
  });

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(
          new Error(
            `Socket ${id} handshake timed out`
          )
        ),
        12000
      );

      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });

      socket.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      socket.connect();
    });

    clients.add(client);

    return client;
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}

function summary(values) {
  if (!values.length) return null;

  const sorted = values.toSorted(
    (a, b) => a - b
  );

  const at = (p) =>
    sorted[
      Math.max(
        0,
        Math.ceil(
          (p / 100) * sorted.length
        ) - 1
      )
    ];

  return {
    count: values.length,

    average_ms:
      values.reduce((s, v) => s + v, 0) /
      values.length,

    p50_ms: at(50),
    p95_ms: at(95),
    p99_ms: at(99),
    max_ms: sorted.at(-1)
  };
}

async function subscribe(subscribers) {
  const before = await metric(
    'websocket_room_joins_total'
  );

  for (const client of subscribers) {
    client.socket.emit('join-match', '1');
  }

  await until(
    async () =>
      (await metric('websocket_room_joins_total')) -
        before === subscribers.length,

    `${subscribers.length} room joins`
  );
}

function eventForBall(ball) {
  return {
    eventId: randomUUID(),
    type: 'BALL_RECORDED',
    aggregateId: 1,

    timestamp: new Date().toISOString(),
    requestId: null,
    traceId: randomUUID(),

    payload: {
      matchId: 1,
      inningsId: 1,
      inningsNumber: 1,
      overNumber: 0,
      ballNumber: ball,

      strikerId: 1,
      nonStrikerId: 2,
      bowlerId: 5,

      runs: {
        batsman: 0,
        extras: 0,
        total: 0
      },

      extras: {
        wide: 0,
        noBall: 0,
        bye: 0,
        legBye: 0,
        penalty: 0
      },

      boundary: {
        four: false,
        six: false
      },

      wicket: {
        occurred: false,
        type: null,
        dismissedPlayerId: null,
        fielderId: null,
        dismissalText: null
      },

      legalDelivery: true,

      commentary: {
        title: null,
        text: 'CI performance test dot ball'
      },

      currentState: {
        strikerId: 1,
        nonStrikerId: 2,
        bowlerId: 5
      }
    }
  };
}

async function publishAndVerify(subscribers, label) {
  const event = eventForBall(++ballNumber);

  const start = performance.now();

  await producer.send({
    topic,
    acks: -1,
    messages: [
      {
        key: '1',
        value: JSON.stringify(event)
      }
    ]
  });

  await until(
    () =>
      subscribers.every(
        (client) =>
          (client.history.get(ballNumber) || [])
            .length >= 1
      ),

    `${label}: BALL_RECORDED ${ballNumber} delivered to all ${subscribers.length} clients`
  );

  await delay(250);

  const duplicates = subscribers.reduce(
    (total, client) =>
      total +
      Math.max(
        0,
        (client.history.get(ballNumber) || [])
          .length - 1
      ),
    0
  );

  if (duplicates) {
    throw new Error(
      `${label}: ${duplicates} duplicate Socket.IO deliveries`
    );
  }

  const persisted = await db.query(
    'SELECT count(*)::int AS count FROM deliveries WHERE event_id=$1',
    [event.eventId]
  );

  if (persisted.rows[0].count !== 1) {
    throw new Error(
      `${label}: expected exactly one persisted event`
    );
  }

  const latencies = subscribers.map(
    (client) =>
      client.history.get(ballNumber)[0] -
      start
  );

  return {
    label,
    event_id: event.eventId,
    ball_number: ballNumber,

    subscribers: subscribers.length,
    delivered: subscribers.length,

    missing: 0,
    duplicates,

    persisted_deliveries: 1,

    publish_to_client_latency:
      summary(latencies)
  };
}

async function runCohort(count) {
  const active = [];

  try {
    const pending = await Promise.all(
      Array.from(
        { length: count },
        (_, i) => connectClient(`${count}-${i}`)
      )
    );

    active.push(...pending);

    await subscribe(active);

    const initial = await publishAndVerify(
      active,
      `initial-${count}`
    );

    const reconnectCount = Math.max(
      1,
      Math.floor(count / 5)
    );

    const reconnectStarted = performance.now();

    const reconnects = active.slice(
      0,
      reconnectCount
    );

    for (const old of reconnects) {
      old.socket.disconnect();
      clients.delete(old);
    }

    for (let i = 0; i < reconnects.length; i++) {
      const old = reconnects[i];

      active[i] = await connectClient(
        old.id,
        old.history
      );
    }

    await subscribe(
      active.slice(0, reconnectCount)
    );

    const reconnectDuration =
      performance.now() - reconnectStarted;

    const afterReconnect = await publishAndVerify(
      active,
      `reconnected-${count}`
    );

    return {
      concurrent_clients: count,
      initially_connected: count,

      reconnected_clients: reconnectCount,

      reconnect_and_resubscribe_duration_ms:
        reconnectDuration,

      initial,
      after_reconnect: afterReconnect
    };
  } finally {
    for (const client of active) {
      client.socket.disconnect();
      clients.delete(client);
    }

    await delay(150);
  }
}

async function main() {
  const report = {
    phase: '25.8.6.5',
    tested_at: new Date().toISOString(),

    target: 'isolated-github-hosted-runner',

    test_type:
      'real-kafka-db-socketio-delivery-reconnection',

    topic,
    match_id: 1,
    cohorts,

    status: 'failed',
    results: [],

    limitations: [
      'One server, single local Kafka and Redis instances',
      'Short sequential bursts, not sustained load',
      'Publish-to-client latency includes Kafka, PostgreSQL, Redis and Socket.IO processing',
      'Reconnection is explicit, not Socket.IO automatic reconnect/backoff',
      'No cross-instance Redis adapter failover or broker outage tested'
    ]
  };

  let failed = null;

  try {
    await db.connect();

    const preflight = await db.query(`
      SELECT
        (SELECT count(*) FROM deliveries) AS deliveries,
        (SELECT count(*) FROM innings
          WHERE id=1 AND scorecard_id=1) AS innings,
        (SELECT count(*) FROM batting_performances
          WHERE innings_id=1 AND player_id=1) AS batter,
        (SELECT count(*) FROM bowling_performances
          WHERE innings_id=1 AND player_id=5) AS bowler,
        (SELECT legal_balls FROM innings
          WHERE id=1) AS legal_balls
    `);

    const p = preflight.rows[0];

    if (
      Number(p.deliveries) !== 0 ||
      Number(p.innings) !== 1 ||
      Number(p.batter) !== 1 ||
      Number(p.bowler) !== 1 ||
      Number(p.legal_balls) !== 0
    ) {
      throw new Error(
        'CI database is not in the clean expected seed state; refusing to inject deliveries'
      );
    }

    await producer.connect();

    for (const count of cohorts) {
      console.log(
        `Testing actual BALL_RECORDED fan-out at ${count} clients`
      );

      report.results.push(
        await runCohort(count)
      );
    }

    report.status = 'passed';
    report.event_count = ballNumber;

    report.client_deliveries_verified =
      report.results.reduce(
        (n, r) =>
          n +
          r.initial.delivered +
          r.after_reconnect.delivered,
        0
      );

  } catch (error) {
    failed = error;

    report.error = error.message;
    report.event_count = ballNumber;

  } finally {
    for (const client of clients) {
      client.socket.disconnect();
    }

    await Promise.allSettled([
      producer.disconnect(),
      db.end()
    ]);

    await mkdir(
      'benchmark-evidence',
      { recursive: true }
    );

    await writeFile(
      'benchmark-evidence/websocket-delivery-profile.json',
      JSON.stringify(report, null, 2) + '\n'
    );

    console.log(
      JSON.stringify(report, null, 2)
    );
  }

  if (failed) throw failed;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

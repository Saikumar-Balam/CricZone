
import { createClient } from 'redis';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';

const baseUrl = process.env.BASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
const matchId = process.env.MATCH_ID || '1';

if (
  process.env.NODE_ENV !== 'test' ||
  process.env.GITHUB_ACTIONS !== 'true' ||
  process.env.ISOLATED_TEST_ENV !== 'true' ||
  process.env.PROFILE !== 'capacity' ||
  process.env.CRICZONE_CI_CAPACITY_TEST !== 'true'
) {
  throw new Error('Isolated CI capacity environment required');
}

if (
  !/^http:\/\/(127\.0\.0\.1|localhost):3000\/?$/.test(baseUrl || '') ||
  !/^redis:\/\/(127\.0\.0\.1|localhost):6379\/?$/.test(redisUrl || '')
) {
  throw new Error('Only isolated localhost services are allowed');
}

if (!/^[1-9]\d*$/.test(matchId)) {
  throw new Error('Invalid MATCH_ID');
}

const redis = createClient({
  url: redisUrl,
  disableOfflineQueue: true
});

redis.on('error', (error) => {
  console.error('Redis error:', error.message);
});

const percentile = (values, percentage) => {
  if (!values.length) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((percentage / 100) * sorted.length) - 1;

  return sorted[Math.max(0, rank)];
};

const summarize = (values) => ({
  count: values.length,
  average_ms: values.reduce((a, b) => a + b, 0) / values.length,
  p50_ms: percentile(values, 50),
  p95_ms: percentile(values, 95),
  p99_ms: percentile(values, 99),
  max_ms: Math.max(...values)
});

const parseInfo = (value) => {
  const result = {};

  for (const line of value.split('\n')) {
    const match = line.trim().match(/^([^:#]+):(.+)$/);
    if (match) result[match[1]] = match[2];
  }

  return result;
};

const requestMatch = async () => {
  const start = performance.now();

  const response = await fetch(
    `${baseUrl.replace(/\/$/, '')}/api/v1/matches/${matchId}`
  );

  const duration = performance.now() - start;

  if (!response.ok) {
    throw new Error(`Match API returned HTTP ${response.status}`);
  }

  const payload = await response.json();

  if (payload.success !== true || payload.data == null) {
    throw new Error('Invalid match API payload');
  }

  return {
    duration_ms: duration,
    payload: payload.data
  };
};

const measureCommand = async (operation, samples = 100) => {
  const times = [];

  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    await operation(i);
    times.push(performance.now() - start);
  }

  return summarize(times);
};

const main = async () => {
  await redis.connect();

  const cacheKey = `match:${matchId}`;
  const probePrefix = `ci:redis-profile:${process.pid}`;

  const beforeStats = parseInfo(await redis.info('stats'));

  try {
    await redis.del(cacheKey);

    const beforeCold = await redis.get(cacheKey);

    if (beforeCold !== null) {
      throw new Error('Cache was not cleared before cold request');
    }

    const cold = await requestMatch();

    const cachedValue = await redis.get(cacheKey);

    if (cachedValue === null) {
      throw new Error('Match request did not populate Redis');
    }

    const populatedTtl = await redis.ttl(cacheKey);

    if (populatedTtl <= 0 || populatedTtl > 60) {
      throw new Error(`Unexpected match cache TTL: ${populatedTtl}`);
    }

    const warm = await requestMatch();

    if (
      JSON.stringify(cold.payload) !==
      JSON.stringify(warm.payload)
    ) {
      throw new Error('Cold and warm API responses differ');
    }

    const getHit = await measureCommand(
      () => redis.get(cacheKey)
    );

    const getMiss = await measureCommand(
      (i) => redis.get(`${probePrefix}:missing:${i}`)
    );

    const set = await measureCommand(
      (i) => redis.set(`${probePrefix}:set:${i}`, 'test', { EX: 60 })
    );

    const del = await measureCommand(
      (i) => redis.del(`${probePrefix}:set:${i}`)
    );

    const afterStats = parseInfo(await redis.info('stats'));
    const memory = parseInfo(await redis.info('memory'));
    const keyspace = parseInfo(await redis.info('keyspace'));

    const result = {
      phase: '25.8.4',
      tested_at: new Date().toISOString(),
      target: 'isolated-github-hosted-runner',
      redis_version: (await redis.info('server'))
        .match(/redis_version:([^\r\n]+)/)?.[1] ?? null,
      match_id: matchId,
      cache_key: cacheKey,
      cache_population_verified: true,
      ttl_seconds_after_population: populatedTtl,
      cold_request_ms: cold.duration_ms,
      warm_request_ms: warm.duration_ms,
      cold_warm_payload_equal: true,
      command_latency: {
        get_hit: getHit,
        get_miss: getMiss,
        set,
        del
      },
      redis_stats_delta: {
        keyspace_hits:
          Number(afterStats.keyspace_hits || 0) -
          Number(beforeStats.keyspace_hits || 0),
        keyspace_misses:
          Number(afterStats.keyspace_misses || 0) -
          Number(beforeStats.keyspace_misses || 0),
        evicted_keys:
          Number(afterStats.evicted_keys || 0) -
          Number(beforeStats.evicted_keys || 0)
      },
      memory: {
        used_memory_bytes: Number(memory.used_memory || 0),
        used_memory_peak_bytes: Number(memory.used_memory_peak || 0),
        maxmemory_bytes: Number(memory.maxmemory || 0),
        maxmemory_policy: memory.maxmemory_policy || null
      },
      keyspace,
      limitations: [
        'Cold and warm HTTP timings are individual samples',
        'Command timings include Node.js client round trips',
        'Redis keyspace counters are server-wide',
        'A cache hit does not prove PostgreSQL consistency checks were skipped',
        'This test does not simulate concurrent cache invalidation'
      ]
    };

    await mkdir('benchmark-evidence', { recursive: true });

    await writeFile(
      'benchmark-evidence/redis-cache-profile.json',
      JSON.stringify(result, null, 2)
    );

    console.log(JSON.stringify(result, null, 2));

  } finally {
    await redis.quit();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

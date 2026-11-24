
import { Kafka, logLevel } from 'kafkajs';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

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

if (process.env.KAFKA_BROKERS !== 'localhost:9092') {
  throw new Error(
    'Kafka benchmark is restricted to the isolated local broker'
  );
}

const runId = (
  process.env.GITHUB_RUN_ID || String(process.pid)
).replace(/[^a-zA-Z0-9_-]/g, '');

const topic = `criczone.perf.${runId}`;
const groupId = `criczone-perf-${runId}`;

const total = 1000;
const batchSize = 100;

const kafka = new Kafka({
  clientId: `criczone-perf-${runId}`,
  brokers: ['localhost:9092'],
  logLevel: logLevel.ERROR,
  connectionTimeout: 10000,
  requestTimeout: 30000
});

const admin = kafka.admin();

const producer = kafka.producer({
  allowAutoTopicCreation: false
});

const consumer = kafka.consumer({
  groupId,
  allowAutoTopicCreation: false
});

const seen = new Set();
const latencies = [];

let firstConsumedAt = null;
let lastConsumedAt = null;
let lastOffset = -1;

let resolveDrain;

const drained = new Promise((resolve) => {
  resolveDrain = resolve;
});

let resolveJoin;

const joined = new Promise((resolve) => {
  resolveJoin = resolve;
});

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);

  const pct = (p) =>
    sorted[
      Math.max(
        0,
        Math.ceil((p / 100) * sorted.length) - 1
      )
    ];

  return {
    count: values.length,
    average_ms:
      values.reduce((a, b) => a + b, 0) /
      values.length,
    p50_ms: pct(50),
    p95_ms: pct(95),
    p99_ms: pct(99),
    max_ms: sorted.at(-1)
  };
}

async function withTimeout(promise, milliseconds, label) {
  let timer;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out`)),
          milliseconds
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic,
          numPartitions: 1,
          replicationFactor: 1
        }
      ]
    });

    await producer.connect();
    await consumer.connect();

    consumer.on(consumer.events.GROUP_JOIN, () => {
      resolveJoin();
    });

    await consumer.subscribe({
      topic,
      fromBeginning: true
    });

    await consumer.run({
      autoCommit: false,

      eachMessage: async ({ message }) => {
        const record = JSON.parse(
          message.value.toString()
        );

        if (record.runId !== runId) {
          throw new Error('Unexpected benchmark record');
        }

        if (seen.has(record.id)) {
          throw new Error(
            `Duplicate message: ${record.id}`
          );
        }

        seen.add(record.id);

        const now = Date.now();

        if (firstConsumedAt === null) {
          firstConsumedAt = now;
        }

        lastConsumedAt = now;
        lastOffset = Number(message.offset);

        latencies.push(
          Math.max(0, now - record.sentAt)
        );

        if (seen.size === total) {
          resolveDrain();
        }
      }
    });

    await withTimeout(
      joined,
      30000,
      'Consumer group assignment'
    );

    const startedAt = performance.now();
    const producerStart = performance.now();

    for (let i = 0; i < total; i += batchSize) {
      const values = Array.from(
        {
          length: Math.min(
            batchSize,
            total - i
          )
        },
        (_, j) => ({
          key: String(i + j),
          value: JSON.stringify({
            runId,
            id: i + j,
            sentAt: Date.now()
          })
        })
      );

      await producer.send({
        topic,
        acks: -1,
        messages: values
      });
    }

    const producerEnd = performance.now();

    await withTimeout(
      drained,
      60000,
      'Consumer drain'
    );

    const finishedAt = performance.now();

    if (seen.size !== total) {
      throw new Error(
        `Consumed only ${seen.size}/${total} messages`
      );
    }

    await consumer.commitOffsets([
      {
        topic,
        partition: 0,
        offset: String(lastOffset + 1)
      }
    ]);

    const endOffsets =
      await admin.fetchTopicOffsets(topic);

    const committed = await admin.fetchOffsets({
      groupId,
      topics: [topic]
    });

    const end = Number(
      endOffsets.find(
        (p) => p.partition === 0
      )?.offset
    );

    const committedOffset = Number(
      committed.find(
        (t) => t.topic === topic
      )?.partitions.find(
        (p) => p.partition === 0
      )?.offset
    );

    const lag = end - committedOffset;

    if (!Number.isFinite(lag) || lag !== 0) {
      throw new Error(
        `Unexpected committed lag: ${lag}`
      );
    }

    const result = {
      phase: '25.8.5',
      tested_at: new Date().toISOString(),
      target: 'isolated-github-hosted-runner',
      test_type: 'kafka-broker-and-test-consumer',

      topic,
      consumer_group: groupId,
      partitions: 1,

      expected_messages: total,
      produced_messages: total,
      consumed_unique_messages: seen.size,

      producer_duration_ms:
        producerEnd - producerStart,

      producer_throughput_messages_per_second:
        total * 1000 /
        (producerEnd - producerStart),

      end_to_end_duration_ms:
        finishedAt - startedAt,

      end_to_end_throughput_messages_per_second:
        total * 1000 /
        (finishedAt - startedAt),

      consume_active_duration_ms:
        lastConsumedAt - firstConsumedAt,

      delivery_latency: stats(latencies),

      partition_end_offset: end,
      group_committed_offset: committedOffset,
      committed_consumer_lag: lag,

      data_integrity: {
        missing_messages: total - seen.size,
        duplicate_messages: 0
      },

      limitations: [
        'One topic and one partition on a GitHub-hosted runner',
        'Consumer is a dedicated measurement consumer, not CricZone event-processing business logic',
        'Delivery timing includes runtime scheduling and batching',
        'No broker-failure, rebalance, or sustained-backlog stress test'
      ]
    };

    await mkdir(
      'benchmark-evidence',
      { recursive: true }
    );

    await writeFile(
      'benchmark-evidence/kafka-profile.json',
      JSON.stringify(result, null, 2) + '\n'
    );

    console.log(
      JSON.stringify(result, null, 2)
    );

  } finally {
    await Promise.allSettled([
      consumer.disconnect(),
      producer.disconnect()
    ]);

    await admin.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

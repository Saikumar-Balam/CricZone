
import pg from "pg";
import { performance } from "node:perf_hooks";
import fs from "node:fs";

const { Pool } = pg;

const EXPECTED_HOST =
  "ep-rapid-art-b3c25h0d-pooler.c-4.ap-southeast-1.aws.neon.tech";

const DATABASE_URL = process.env.BENCHMARK_DATABASE_URL;

const CONCURRENCY = Number(
  process.env.BENCHMARK_CONCURRENCY ?? 10
);

const TOTAL_QUERIES = Number(
  process.env.BENCHMARK_TOTAL_QUERIES ?? 300
);

const POOL_SIZE = Number(
  process.env.BENCHMARK_POOL_SIZE ?? 10
);

const OUTPUT_FILE =
  process.env.BENCHMARK_OUTPUT_FILE ??
  "postgres-benchmark-results.json";

function validateInteger(name, value, min, max) {
  if (
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Error(
      `${name} must be between ${min} and ${max}`
    );
  }
}

function validateConfiguration() {
  if (!DATABASE_URL) {
    throw new Error(
      "BENCHMARK_DATABASE_URL is required"
    );
  }

  const parsed = new URL(DATABASE_URL);

  if (
    !["postgres:", "postgresql:"].includes(
      parsed.protocol
    )
  ) {
    throw new Error(
      "Invalid PostgreSQL URL protocol"
    );
  }

  if (parsed.hostname !== EXPECTED_HOST) {
    throw new Error(
      "SAFETY ERROR: Refusing connection to a non-benchmark Neon endpoint"
    );
  }

  if (parsed.pathname !== "/neondb") {
    throw new Error(
      "SAFETY ERROR: Expected neondb database"
    );
  }

  if (
    !["require", "verify-full"].includes(
      parsed.searchParams.get("sslmode")
    )
  ) {
    throw new Error(
      "SSL mode must be require or verify-full"
    );
  }

  validateInteger(
    "BENCHMARK_CONCURRENCY",
    CONCURRENCY,
    1,
    50
  );

  validateInteger(
    "BENCHMARK_TOTAL_QUERIES",
    TOTAL_QUERIES,
    1,
    10000
  );

  validateInteger(
    "BENCHMARK_POOL_SIZE",
    POOL_SIZE,
    1,
    20
  );
}

validateConfiguration();

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: POOL_SIZE,
  min: 0,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 10000,
  statement_timeout: 10000,
  query_timeout: 15000,
  application_name: "criczone-postgres-benchmark",
});

// Selected once during setup, before timing begins.
const benchmarkContext = {
  commentaryMatchId: null,
  battingInningsId: null,
  bowlingInningsId: null,
  deliveryInningsId: null,
};

const QUERIES = [
  {
    name: "recent_matches",
    sql: `
      SELECT
        id,
        series_id,
        team1_id,
        team2_id,
        format,
        status,
        start_time
      FROM matches
      WHERE status = 'COMPLETED'
      ORDER BY start_time DESC
      LIMIT 20
    `,
    params: () => [],
  },

  {
    name: "recent_commentary",
    sql: `
      SELECT
        id,
        match_id,
        innings_id,
        event_type,
        over_number,
        ball_number,
        text,
        sequence_number
      FROM commentary_events
      WHERE match_id = $1
      ORDER BY sequence_number DESC
      LIMIT 20
    `,
    params: () => [
      benchmarkContext.commentaryMatchId,
    ],
  },

  {
    name: "batting_scorecard",
    sql: `
      SELECT
        bp.id,
        bp.innings_id,
        bp.player_id,
        p.name AS player_name,
        bp.runs,
        bp.balls_faced
      FROM batting_performances bp
      JOIN players p
        ON p.id = bp.player_id
      WHERE bp.innings_id = $1
      ORDER BY bp.runs DESC
    `,
    params: () => [
      benchmarkContext.battingInningsId,
    ],
  },

  {
    name: "bowling_scorecard",
    sql: `
      SELECT
        bp.id,
        bp.innings_id,
        bp.player_id,
        p.name AS player_name,
        bp.overs,
        bp.runs_conceded,
        bp.wickets
      FROM bowling_performances bp
      JOIN players p
        ON p.id = bp.player_id
      WHERE bp.innings_id = $1
      ORDER BY bp.wickets DESC
    `,
    params: () => [
      benchmarkContext.bowlingInningsId,
    ],
  },

  {
    name: "innings_deliveries",
    sql: `
      SELECT
        id,
        match_id,
        innings_id,
        over_number,
        ball_number,
        striker_id,
        bowler_id,
        batsman_runs,
        total_runs
      FROM deliveries
      WHERE innings_id = $1
      ORDER BY over_number ASC, ball_number ASC
    `,
    params: () => [
      benchmarkContext.deliveryInningsId,
    ],
  },
];

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return null;
  }

  const index = Math.max(
    0,
    Math.ceil(
      (p / 100) * sortedValues.length
    ) - 1
  );

  return sortedValues[index];
}

function summarize(values) {
  if (values.length === 0) {
    return {
      count: 0,
      averageMs: null,
      p50Ms: null,
      p95Ms: null,
      p99Ms: null,
      maxMs: null,
    };
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const sum = values.reduce(
    (total, value) => total + value,
    0
  );

  return {
    count: values.length,
    averageMs: Number(
      (sum / values.length).toFixed(3)
    ),
    p50Ms: Number(
      percentile(sorted, 50).toFixed(3)
    ),
    p95Ms: Number(
      percentile(sorted, 95).toFixed(3)
    ),
    p99Ms: Number(
      percentile(sorted, 99).toFixed(3)
    ),
    maxMs: Number(
      sorted[sorted.length - 1].toFixed(3)
    ),
  };
}

async function withReadOnlyTransaction(callback) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;

    const result = await callback(client);

    await client.query("COMMIT");
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(
        () => {}
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

async function verifyBenchmarkDatabase() {
  await withReadOnlyTransaction(
    async (client) => {
      const identity = await client.query(`
        SELECT
          current_database() AS database_name,
          current_user AS database_user,
          inet_server_addr()::text
            AS server_address
      `);

      if (
        identity.rows[0].database_name !==
        "neondb"
      ) {
        throw new Error(
          "Unexpected database name"
        );
      }

      const seed = await client.query(`
        SELECT COUNT(*)::int AS count
        FROM teams
        WHERE name LIKE 'BENCH_TEAM\\_%'
      `);

      if (seed.rows[0].count !== 100) {
        throw new Error(
          `Expected 100 benchmark teams, found ${seed.rows[0].count}`
        );
      }

      console.log(
        "Benchmark endpoint verified"
      );

      console.log(
        `Database: ${identity.rows[0].database_name}`
      );

      console.log(
        `Benchmark teams: ${seed.rows[0].count}`
      );
    }
  );
}

async function selectBenchmarkData() {
  await withReadOnlyTransaction(
    async (client) => {
      const commentary = await client.query(`
        SELECT match_id
        FROM commentary_events
        GROUP BY match_id
        ORDER BY COUNT(*) DESC, match_id ASC
        LIMIT 1
      `);

      if (commentary.rowCount === 0) {
        throw new Error(
          "No commentary events available"
        );
      }

      benchmarkContext.commentaryMatchId =
        commentary.rows[0].match_id;

      const batting = await client.query(`
        SELECT innings_id
        FROM batting_performances
        GROUP BY innings_id
        ORDER BY COUNT(*) DESC, innings_id DESC
        LIMIT 1
      `);

      if (batting.rowCount === 0) {
        throw new Error(
          "No batting performances available"
        );
      }

      benchmarkContext.battingInningsId =
        batting.rows[0].innings_id;

      const bowling = await client.query(`
        SELECT innings_id
        FROM bowling_performances
        GROUP BY innings_id
        ORDER BY COUNT(*) DESC, innings_id DESC
        LIMIT 1
      `);

      if (bowling.rowCount === 0) {
        throw new Error(
          "No bowling performances available"
        );
      }

      benchmarkContext.bowlingInningsId =
        bowling.rows[0].innings_id;

      const deliveries = await client.query(`
        SELECT innings_id
        FROM deliveries
        GROUP BY innings_id
        ORDER BY COUNT(*) DESC, innings_id DESC
        LIMIT 1
      `);

      if (deliveries.rowCount === 0) {
        throw new Error(
          "No deliveries available"
        );
      }

      benchmarkContext.deliveryInningsId =
        deliveries.rows[0].innings_id;
    }
  );

  console.log(
    "Selected benchmark data:",
    benchmarkContext
  );
}

async function executeReadOnlyQuery(query) {
  return withReadOnlyTransaction(
    async (client) => {
      const result = await client.query(
        query.sql,
        query.params()
      );

      return result.rowCount;
    }
  );
}

async function validateBenchmarkQueries() {
  console.log(
    "\nValidating benchmark query results..."
  );

  const validation = {};

  for (const query of QUERIES) {
    const rows = await executeReadOnlyQuery(
      query
    );

    if (rows === 0) {
      throw new Error(
        `Benchmark validation failed: ${query.name} returned zero rows`
      );
    }

    validation[query.name] = rows;

    console.log(
      `${query.name}: ${rows} rows verified`
    );
  }

  console.log(
    "All benchmark queries validated\n"
  );

  return validation;
}

async function main() {
  console.log(
    "Starting CricZone PostgreSQL concurrency benchmark"
  );

  console.log({
    concurrency: CONCURRENCY,
    totalQueries: TOTAL_QUERIES,
    poolSize: POOL_SIZE,
    queryTypes: QUERIES.map(
      (query) => query.name
    ),
  });

  await verifyBenchmarkDatabase();

  await selectBenchmarkData();

  const validation =
    await validateBenchmarkQueries();

  const samples = [];
  const errors = [];

  const byQuery = Object.fromEntries(
    QUERIES.map(
      (query) => [query.name, []]
    )
  );

  const rowStats = Object.fromEntries(
    QUERIES.map((query) => [
      query.name,
      {
        totalRowsReturned: 0,
        zeroRowQueries: 0,
        minRowsReturned: null,
        maxRowsReturned: 0,
      },
    ])
  );

  let nextIndex = 0;
  let peakPoolTotal = 0;
  let peakPoolWaiting = 0;

  function capturePoolStats() {
    peakPoolTotal = Math.max(
      peakPoolTotal,
      pool.totalCount
    );

    peakPoolWaiting = Math.max(
      peakPoolWaiting,
      pool.waitingCount
    );
  }

  async function worker() {
    while (true) {
      const index = nextIndex++;

      if (index >= TOTAL_QUERIES) {
        return;
      }

      const query =
        QUERIES[index % QUERIES.length];

      const start = performance.now();

      try {
        const rows =
          await executeReadOnlyQuery(query);

        const duration =
          performance.now() - start;

        samples.push(duration);

        byQuery[query.name].push(
          duration
        );

        const stats = rowStats[query.name];

        stats.totalRowsReturned += rows;

        if (rows === 0) {
          stats.zeroRowQueries++;
        }

        stats.minRowsReturned =
          stats.minRowsReturned === null
            ? rows
            : Math.min(
                stats.minRowsReturned,
                rows
              );

        stats.maxRowsReturned = Math.max(
          stats.maxRowsReturned,
          rows
        );

        capturePoolStats();

        if (index < 5) {
          console.log(
            `${query.name}: ${rows} rows, ${duration.toFixed(3)} ms`
          );
        }
      } catch (error) {
        errors.push({
          query: query.name,
          message: error.message,
        });

        capturePoolStats();
      }
    }
  }

  const startedAt =
    new Date().toISOString();

  const start = performance.now();

  await Promise.all(
    Array.from(
      { length: CONCURRENCY },
      () => worker()
    )
  );

  const elapsedSeconds =
    (performance.now() - start) / 1000;

  const successfulQueries =
    samples.length;

  const failedQueries =
    errors.length;

  const report = {
    benchmark:
      "CricZone PostgreSQL Concurrent Query Test",

    startedAt,

    configuration: {
      concurrency: CONCURRENCY,
      totalQueries: TOTAL_QUERIES,
      poolSize: POOL_SIZE,
    },

    validation: {
      queryRowsBeforeBenchmark:
        validation,
      selectedData: benchmarkContext,
    },

    results: {
      successfulQueries,
      failedQueries,

      errorRatePercent: Number(
        (
          (failedQueries / TOTAL_QUERIES) *
          100
        ).toFixed(2)
      ),

      durationSeconds: Number(
        elapsedSeconds.toFixed(3)
      ),

      throughputQps: Number(
        (
          successfulQueries /
          elapsedSeconds
        ).toFixed(2)
      ),

      latency: summarize(samples),
    },

    pool: {
      peakConnections:
        peakPoolTotal,

      peakWaitingClientsObserved:
        peakPoolWaiting,
    },

    queryBreakdown:
      Object.fromEntries(
        Object.entries(byQuery).map(
          ([name, values]) => [
            name,
            {
              ...summarize(values),
              ...rowStats[name],
            },
          ]
        )
      ),

    errors: errors.slice(0, 20),
  };

  console.log(
    "\n=== PostgreSQL Benchmark Results ==="
  );

  console.log(
    JSON.stringify(report, null, 2)
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(report, null, 2)
  );

  if (
    failedQueries > 0 ||
    Object.values(rowStats).some(
      (stats) => stats.zeroRowQueries > 0
    )
  ) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(
    "Benchmark failed:",
    error.message
  );

  process.exitCode = 1;
} finally {
  await pool.end();
}

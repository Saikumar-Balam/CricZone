
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import databaseConfig from "../../../src/config/database.config.js";
import PostgresDatabaseClient from "../../../src/database/postgres/PostgresDatabaseClient.js";
import PostgresRetryStrategy from "../../../src/database/postgres/PostgresRetryStrategy.js";

const databaseUrl = new URL(databaseConfig.connectionString);

if (
    process.env.NODE_ENV !== "test" ||
    databaseUrl.hostname !== "127.0.0.1" ||
    databaseUrl.port !== "55432" ||
    databaseUrl.pathname !== "/criczone_resilience" ||
    databaseUrl.username !== "criczone_test"
) {
    throw new Error(
        "Refusing to run resilience benchmark outside isolated test database"
    );
}

const database = new PostgresDatabaseClient(
    databaseConfig,
    new PostgresRetryStrategy({
        maxRetries: 2,
        baseDelayMs: 200
    })
);

const testId = crypto.randomUUID();

try {
    console.log("Starting PostgreSQL baseline test");

    // 1. Establish PostgreSQL connection
    await database.connect();

    // 2. Create isolated resilience test table
    await database.query(`
        CREATE TABLE IF NOT EXISTS resilience_test_records (
            id UUID PRIMARY KEY,
            event_type TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    console.log("Test table ready");

    // 3. Insert test cricket event
    await database.query(
        `INSERT INTO resilience_test_records (id, event_type)
         VALUES ($1, $2)`,
        [testId, "BALL_SCORED"]
    );

    console.log("Test record committed");

    // 4. Read committed record
    const result = await database.query(
        `SELECT id, event_type
         FROM resilience_test_records
         WHERE id = $1`,
        [testId]
    );

    // 5. Verify committed record integrity
    if (
        result.rows.length !== 1 ||
        result.rows[0].id !== testId ||
        result.rows[0].event_type !== "BALL_SCORED"
    ) {
        throw new Error(
            "PostgreSQL baseline integrity check failed"
        );
    }

    console.log("Committed record verified");

    // 6. Create results directory
    const resultsDir = path.resolve(
        "benchmarks/resilience/postgres/results"
    );

    fs.mkdirSync(resultsDir, {
        recursive: true
    });

    // 7. Persist successful baseline test results
    const baselineResult = {
        status: "PASSED",
        recordVerified: true,
        recordId: testId,
        eventType: "BALL_SCORED",
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(
        path.join(resultsDir, "baseline.json"),
        JSON.stringify(baselineResult, null, 2),
        "utf8"
    );

    console.log("Baseline results saved successfully");
    console.log("PostgreSQL baseline test PASSED");

} finally {
    await database.disconnect();
}

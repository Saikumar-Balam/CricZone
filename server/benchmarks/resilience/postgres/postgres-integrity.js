
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import PostgresDatabaseClient from "../../../src/database/postgres/PostgresDatabaseClient.js";

const EXPECTED_DATABASE_URL =
    "postgresql://criczone_test:criczone_test@127.0.0.1:55432/criczone_resilience";

const RESULTS_DIR = path.resolve(
    "benchmarks/resilience/postgres/results"
);

const BASELINE_FILE = path.join(
    RESULTS_DIR,
    "baseline.json"
);

const INTEGRITY_FILE = path.join(
    RESULTS_DIR,
    "integrity.json"
);

if (
    process.env.NODE_ENV !== "test" ||
    process.env.DATABASE_URL !== EXPECTED_DATABASE_URL
) {
    throw new Error(
        "Integrity verification requires isolated PostgreSQL test database"
    );
}

fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.rmSync(INTEGRITY_FILE, { force: true });

const database = new PostgresDatabaseClient({
    connectionString: process.env.DATABASE_URL,
    ssl: false,
    max: Number(process.env.DB_POOL_MAX || 5),
    idleTimeoutMillis: Number(
        process.env.DB_IDLE_TIMEOUT_MS || 1000
    ),
    connectionTimeoutMillis: Number(
        process.env.DB_CONNECTION_TIMEOUT_MS || 1000
    ),
    statementTimeoutMillis: Number(
        process.env.DB_STATEMENT_TIMEOUT_MS || 3000
    )
});

let result;

try {
    console.log(
        "Starting PostgreSQL post-restart integrity verification"
    );

    if (!fs.existsSync(BASELINE_FILE)) {
        throw new Error(
            "Baseline result file is missing"
        );
    }

    const baseline = JSON.parse(
        fs.readFileSync(BASELINE_FILE, "utf8")
    );

    if (
        baseline.status !== "PASSED" ||
        baseline.recordVerified !== true ||
        typeof baseline.recordId !== "string" ||
        baseline.recordId.length === 0 ||
        baseline.eventType !== "BALL_SCORED"
    ) {
        throw new Error(
            "Baseline result is invalid"
        );
    }

    const start = performance.now();

    await database.connect();

    const queryResult = await database.query(
        `
        SELECT id, event_type
        FROM resilience_test_records
        WHERE id = $1
        `,
        [baseline.recordId]
    );

    const verificationDurationMs = Number(
        (performance.now() - start).toFixed(2)
    );

    const record = queryResult.rows[0];

    if (
        queryResult.rowCount !== 1 ||
        record?.id !== baseline.recordId ||
        record?.event_type !== baseline.eventType
    ) {
        throw new Error(
            "Committed baseline record was not preserved after restart"
        );
    }

    result = {
        status: "PASSED",
        committedRecordPreserved: true,
        recordId: record.id,
        eventType: record.event_type,
        verificationDurationMs,
        timestamp: new Date().toISOString()
    };

    console.log(
        "Committed PostgreSQL record survived restart"
    );

    console.log(
        `Verified record ID: ${record.id}`
    );

    console.log(
        "Post-restart data integrity PASSED"
    );

} catch (error) {
    result = {
        status: "FAILED",
        committedRecordPreserved: false,
        error: error.message,
        timestamp: new Date().toISOString()
    };

    process.exitCode = 1;

    console.error(
        "Post-restart data integrity FAILED:",
        error.message
    );

} finally {
    try {
        await database.disconnect();
    } catch (error) {
        process.exitCode = 1;

        result = {
            ...result,
            status: "FAILED",
            committedRecordPreserved: false,
            error: `Database cleanup failed: ${error.message}`
        };
    }

    fs.writeFileSync(
        INTEGRITY_FILE,
        JSON.stringify(result, null, 2),
        "utf8"
    );

    console.log(
        "PostgreSQL integrity results saved"
    );
}

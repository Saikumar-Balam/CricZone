
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

import PostgresDatabaseClient from "../../../src/database/postgres/PostgresDatabaseClient.js";
import PostgresRetryStrategy from "../../../src/database/postgres/PostgresRetryStrategy.js";

const EXPECTED_DATABASE_URL =
    "postgresql://criczone_test:criczone_test@127.0.0.1:55432/criczone_resilience";

const RESULTS_DIR = path.resolve(
    "benchmarks/resilience/postgres/results"
);

const READY_FILE = path.join(RESULTS_DIR, "pool-ready.json");
const FAILURE_FILE = path.join(RESULTS_DIR, "pool-failure.json");
const RECOVERY_SIGNAL = path.join(
    RESULTS_DIR,
    "pool-restart-requested"
);
const RECOVERY_FILE = path.join(
    RESULTS_DIR,
    "pool-recovery.json"
);

const MAX_FAILURE_WAIT_MS = 30000;
const MAX_RECOVERY_WAIT_MS = 30000;
const POLL_INTERVAL_MS = 250;

if (
    process.env.NODE_ENV !== "test" ||
    process.env.DATABASE_URL !== EXPECTED_DATABASE_URL
) {
    throw new Error(
        "Pool recovery testing requires the isolated CI database"
    );
}

fs.mkdirSync(RESULTS_DIR, { recursive: true });

for (const file of [
    READY_FILE,
    FAILURE_FILE,
    RECOVERY_SIGNAL,
    RECOVERY_FILE
]) {
    fs.rmSync(file, { force: true });
}

function saveJson(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

const database = new PostgresDatabaseClient(
    {
        connectionString: process.env.DATABASE_URL,
        ssl: false,
        max: 5,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 1000,
        statementTimeoutMillis: 3000
    },
    new PostgresRetryStrategy({
        maxRetries: 2,
        baseDelayMs: 200
    })
);

const originalPool = database.pool;

let phase = "INITIALIZING";

try {
    // 1. Establish the original connection pool

    await database.connect();

    const baseline = await database.query(
        "SELECT 1 AS value"
    );

    if (baseline.rows[0]?.value !== 1) {
        throw new Error("Initial pool query failed");
    }

    phase = "READY";

    saveJson(READY_FILE, {
        status: "READY",
        originalPoolEstablished: true,
        timestamp: new Date().toISOString()
    });

    console.log("Original PostgreSQL pool established");

    // 2. Wait until PostgreSQL becomes unavailable

    const failureStart = performance.now();
    let failureDetected = false;
    let failureCode = null;

    while (
        performance.now() - failureStart <
        MAX_FAILURE_WAIT_MS
    ) {
        const health = await database.healthCheck();

        if (!health.healthy) {
            failureDetected = true;
            failureCode =
                health.error?.code ?? "UNKNOWN";

            break;
        }

        await sleep(POLL_INTERVAL_MS);
    }

    if (!failureDetected) {
        throw new Error(
            "Existing pool did not detect PostgreSQL outage"
        );
    }

    phase = "FAILURE_DETECTED";

    saveJson(FAILURE_FILE, {
        status: "PASSED",
        failureDetected: true,
        error: failureCode,
        timestamp: new Date().toISOString()
    });

    console.log(
        `Existing pool detected PostgreSQL failure: ${failureCode}`
    );

    // 3. Wait for the workflow to request recovery verification

    const signalStart = performance.now();

    while (!fs.existsSync(RECOVERY_SIGNAL)) {
        if (
            performance.now() - signalStart >
            MAX_RECOVERY_WAIT_MS
        ) {
            throw new Error(
                "Timed out waiting for PostgreSQL restart signal"
            );
        }

        await sleep(POLL_INTERVAL_MS);
    }

    phase = "RECOVERING";

    // 4. Reuse the original pool after PostgreSQL restart

    const recoveryStart = performance.now();

    let recovered = false;
    let attempts = 0;
    let lastError = null;

    while (
        performance.now() - recoveryStart <
        MAX_RECOVERY_WAIT_MS
    ) {
        attempts++;

        try {
            const result = await database.query(
                "SELECT 1 AS value"
            );

            if (result.rows[0]?.value !== 1) {
                throw new Error(
                    "Unexpected query result after restart"
                );
            }

            recovered = true;
            break;

        } catch (error) {
            lastError = error;
            await sleep(POLL_INTERVAL_MS);
        }
    }

    if (!recovered) {
        throw new Error(
            "Original PostgreSQL pool failed to recover: " +
            (lastError?.message ?? "Unknown error")
        );
    }

    if (database.pool !== originalPool) {
        throw new Error(
            "PostgreSQL pool instance was unexpectedly replaced"
        );
    }

    const recoveryDurationMs =
        performance.now() - recoveryStart;

    phase = "PASSED";

    saveJson(RECOVERY_FILE, {
        status: "PASSED",
        originalPoolReused: true,
        failureDetected: true,
        connectionRestored: true,
        recoveryAttempts: attempts,
        recoveryDurationMs: Number(
            recoveryDurationMs.toFixed(2)
        ),
        timestamp: new Date().toISOString()
    });

    console.log("Original PostgreSQL pool recovered");
    console.log(`Recovery attempts: ${attempts}`);
    console.log(
        `Pool recovery duration: ${recoveryDurationMs.toFixed(2)} ms`
    );

} catch (error) {
    console.error(
        `Pool resilience test failed during ${phase}:`,
        error
    );

    saveJson(RECOVERY_FILE, {
        status: "FAILED",
        phase,
        error: error.message,
        timestamp: new Date().toISOString()
    });

    process.exitCode = 1;

} finally {
    await database.disconnect();
}

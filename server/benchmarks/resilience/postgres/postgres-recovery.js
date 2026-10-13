
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

import PostgresDatabaseClient from "../../../src/database/postgres/PostgresDatabaseClient.js";
import PostgresRetryStrategy from "../../../src/database/postgres/PostgresRetryStrategy.js";

const EXPECTED_DATABASE_URL =
    "postgresql://criczone_test:criczone_test@127.0.0.1:55432/criczone_resilience";

const MAX_RECOVERY_TIME_MS = 30000;
const POLL_INTERVAL_MS = 250;

const RESULTS_DIR = path.resolve(
    "benchmarks/resilience/postgres/results"
);

const RECOVERY_FILE = path.join(
    RESULTS_DIR,
    "recovery.json"
);

if (
    process.env.NODE_ENV !== "test" ||
    process.env.DATABASE_URL !== EXPECTED_DATABASE_URL
) {
    throw new Error(
        "Recovery testing is restricted to the isolated GitHub Actions database"
    );
}

const restartStartedAtMs = Number(
    process.env.POSTGRES_RESTART_STARTED_AT_MS
);

if (
    !process.env.POSTGRES_RESTART_STARTED_AT_MS ||
    !Number.isFinite(restartStartedAtMs) ||
    restartStartedAtMs <= 0 ||
    restartStartedAtMs > Date.now()
) {
    throw new Error(
        "Valid POSTGRES_RESTART_STARTED_AT_MS is required"
    );
}

fs.mkdirSync(RESULTS_DIR, { recursive: true });

fs.rmSync(RECOVERY_FILE, { force: true });

const database = new PostgresDatabaseClient(
    {
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
    },
    new PostgresRetryStrategy({
        maxRetries: 2,
        baseDelayMs: 200
    })
);

const checkStartedAt = performance.now();

let attempts = 0;
let recovered = false;
let lastError = null;
let querySucceededAtMs = null;

let recoveryResult = null;

try {
    console.log("Starting PostgreSQL recovery verification");

    while (
        performance.now() - checkStartedAt <
        MAX_RECOVERY_TIME_MS
    ) {
        attempts++;

        try {
            const health = await database.healthCheck();

            if (!health.healthy) {
                lastError = health.error;

                console.log(
                    `Recovery attempt ${attempts} failed:`,
                    lastError?.code ??
                        lastError?.message ??
                        "Database unhealthy"
                );

                await sleep(POLL_INTERVAL_MS);
                continue;
            }

            const verification = await database.query(
                "SELECT 1 AS value"
            );

            if (verification.rows[0]?.value !== 1) {
                throw new Error(
                    "Recovery query returned an unexpected result"
                );
            }

            querySucceededAtMs = Date.now();
            recovered = true;
            break;

        } catch (error) {
            lastError = error;

            console.log(
                `Recovery attempt ${attempts} failed:`,
                error.code ?? error.message
            );

            await sleep(POLL_INTERVAL_MS);
        }
    }

    if (!recovered) {
        throw new Error(
            `PostgreSQL did not recover within ${MAX_RECOVERY_TIME_MS} ms. ` +
            `Last error: ${lastError?.message ?? "Unknown"}`
        );
    }

    const recoveryCheckDurationMs = Number(
        (performance.now() - checkStartedAt).toFixed(2)
    );

    const restartToQueryRecoveryMs =
        querySucceededAtMs - restartStartedAtMs;

    if (restartToQueryRecoveryMs < 0) {
        throw new Error(
            "Recovery query timestamp precedes PostgreSQL restart"
        );
    }

    recoveryResult = {
        status: "PASSED",
        connectionRestored: true,
        recoveryAttempts: attempts,
        recoveryCheckDurationMs,
        restartToQueryRecoveryMs,
        restartStartedAt: new Date(
            restartStartedAtMs
        ).toISOString(),
        querySucceededAt: new Date(
            querySucceededAtMs
        ).toISOString(),
        timestamp: new Date().toISOString()
    };

    console.log("PostgreSQL connection restored");
    console.log(`Recovery attempts: ${attempts}`);

    console.log(
        `Recovery check duration: ${recoveryCheckDurationMs} ms`
    );

    console.log(
        `Restart-to-query recovery: ${restartToQueryRecoveryMs} ms`
    );

} catch (error) {
    recoveryResult = {
        status: "FAILED",
        connectionRestored: false,
        recoveryAttempts: attempts,
        error: error.message,
        timestamp: new Date().toISOString()
    };

    process.exitCode = 1;

    console.error(
        "PostgreSQL recovery test FAILED:",
        error.message
    );

} finally {
    try {
        await database.disconnect();
    } catch (error) {
        process.exitCode = 1;

        recoveryResult = {
            ...recoveryResult,
            status: "FAILED",
            error: `Database cleanup failed: ${error.message}`
        };
    }

    fs.writeFileSync(
        RECOVERY_FILE,
        JSON.stringify(recoveryResult, null, 2),
        "utf8"
    );

    console.log("Recovery results saved");
}

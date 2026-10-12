
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

import PostgresDatabaseClient from "../../../src/database/postgres/PostgresDatabaseClient.js";
import PostgresRetryStrategy from "../../../src/database/postgres/PostgresRetryStrategy.js";

const EXPECTED_DATABASE_URL =
    "postgresql://criczone_test:criczone_test@127.0.0.1:55432/criczone_resilience";

const MAX_RECOVERY_TIME_MS = 30000;
const POLL_INTERVAL_MS = 250;

if (
    process.env.NODE_ENV !== "test" ||
    process.env.DATABASE_URL !== EXPECTED_DATABASE_URL
) {
    throw new Error(
        "Recovery testing is restricted to the isolated GitHub Actions database"
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

const startTime = performance.now();

let attempts = 0;
let recovered = false;
let lastError = null;

try {
    console.log("Starting PostgreSQL recovery verification");

    while (performance.now() - startTime < MAX_RECOVERY_TIME_MS) {
        attempts++;

        const result = await database.healthCheck();

        if (result.healthy === true) {
            recovered = true;
            break;
        }

        lastError = result.error;

        console.log(
            `Recovery attempt ${attempts} failed:`,
            lastError?.code ?? lastError?.message ?? "Unknown error"
        );

        await sleep(POLL_INTERVAL_MS);
    }

    const recoveryTimeMs = performance.now() - startTime;

    if (!recovered) {
        throw new Error(
            `PostgreSQL did not recover within ${MAX_RECOVERY_TIME_MS} ms. ` +
            `Last error: ${lastError?.message ?? "Unknown"}`
        );
    }

    const verification = await database.query(
        "SELECT 1 AS value"
    );

    if (verification.rows[0]?.value !== 1) {
        throw new Error(
            "PostgreSQL recovery query returned an unexpected result"
        );
    }

    console.log("PostgreSQL connection restored");
    console.log(`Recovery attempts: ${attempts}`);
    console.log(`Recovery time: ${recoveryTimeMs.toFixed(2)} ms`);
    console.log("PostgreSQL recovery test PASSED");
} finally {
    await database.disconnect();
}


import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import PostgresDatabaseClient from "../../../src/database/postgres/PostgresDatabaseClient.js";
import PostgresRetryStrategy from "../../../src/database/postgres/PostgresRetryStrategy.js";

// 1. Restrict testing to the isolated GitHub Actions database
const expectedDatabaseUrl =
    "postgresql://criczone_test:criczone_test@127.0.0.1:55432/criczone_resilience";

if (
    process.env.NODE_ENV !== "test" ||
    process.env.DATABASE_URL !== expectedDatabaseUrl
) {
    throw new Error(
        "PostgreSQL failure testing is restricted to the isolated CI database"
    );
}

// 2. Initialize PostgreSQL database client
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

try {
    console.log("Starting PostgreSQL failure detection test");

    // 3. Start failure-detection timer
    const startTime = performance.now();

    // 4. Check PostgreSQL availability during outage
    const result = await database.healthCheck();

    // 5. Calculate failure-detection duration
    const detectionTimeMs = performance.now() - startTime;

    // 6. Verify PostgreSQL is unavailable
    if (result.healthy !== false) {
        throw new Error(
            "Expected PostgreSQL health check to report unhealthy during outage"
        );
    }

    console.log("PostgreSQL outage detected");

    console.log(
        `Detection time: ${detectionTimeMs.toFixed(2)} ms`
    );

    const errorCode =
        result.error?.code ??
        result.error?.message ??
        "Unknown";

    console.log("Error:", errorCode);

    // 7. Create results directory
    const resultsDir = path.resolve(
        "benchmarks/resilience/postgres/results"
    );

    fs.mkdirSync(resultsDir, {
        recursive: true
    });

    // 8. Prepare failure-detection result
    const failureResult = {
        status: "PASSED",
        databaseUnhealthy: true,
        detectionTimeMs: Number(
            detectionTimeMs.toFixed(2)
        ),
        error: errorCode,
        timestamp: new Date().toISOString()
    };

    // 9. Save result for resilience report generation
    fs.writeFileSync(
        path.join(resultsDir, "failure.json"),
        JSON.stringify(failureResult, null, 2),
        "utf8"
    );

    console.log("Failure detection results saved successfully");
    console.log("PostgreSQL failure detection test PASSED");

} finally {
    // 10. Release PostgreSQL connection pool
    await database.disconnect();
}

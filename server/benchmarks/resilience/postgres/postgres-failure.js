
import PostgresDatabaseClient from "../../../src/database/postgres/PostgresDatabaseClient.js";
import PostgresRetryStrategy from "../../../src/database/postgres/PostgresRetryStrategy.js";

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

    const startTime = performance.now();

    const result = await database.healthCheck();

    const detectionTimeMs = performance.now() - startTime;

    if (result.healthy !== false) {
        throw new Error(
            "Expected PostgreSQL health check to report unhealthy during outage"
        );
    }

    console.log("PostgreSQL outage detected");
    console.log(`Detection time: ${detectionTimeMs.toFixed(2)} ms`);

    console.log(
        "Error:",
        result.error?.code ?? result.error?.message ?? "Unknown"
    );

    console.log("PostgreSQL failure detection test PASSED");
} finally {
    await database.disconnect();
}

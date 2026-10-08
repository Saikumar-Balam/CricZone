
import PostgresDatabaseClient from "../../src/database/postgres/PostgresDatabaseClient.js";
import dotenv from "dotenv";

dotenv.config({
    path: ".env.test"
});

export function createTestDatabase() {
    const connectionString = process.env.TEST_DATABASE_URL;

    if (!connectionString) {
        throw new Error("TEST_DATABASE_URL is not configured");
    }

    // CI PostgreSQL runs locally without TLS.
    // Neon PostgreSQL requires TLS.
    const isLocalDatabase = ["localhost", "127.0.0.1"].includes(
        new URL(connectionString).hostname
    );

    return new PostgresDatabaseClient({
        connectionString,

        ssl: isLocalDatabase
            ? false
            : {
                rejectUnauthorized: true
            },

        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
        statementTimeoutMillis: 5000
    });
}

import {
    describe,
    it,
    expect,
    afterEach
} from "vitest"

import dotenv from "dotenv"

import PostgresDatabaseClient
    from "../../../src/database/postgres/PostgresDatabaseClient.js"


dotenv.config({
    path: ".env.test"
})


describe("PostgreSQL Query Timeout", () => {

    let databaseClient = null
    let client = null


    afterEach(async () => {

        if (client) {
            client.release()
            client = null
        }

        if (databaseClient) {
            await databaseClient.disconnect()
            databaseClient = null
        }
    })


    it("should cancel a query that exceeds the statement timeout", async () => {

        // Arrange
        databaseClient =
            new PostgresDatabaseClient({
                connectionString:
                    process.env.TEST_DATABASE_URL,

                ssl: {
                    rejectUnauthorized: true
                },

                max: 1,

                idleTimeoutMillis: 10000,

                connectionTimeoutMillis: 5000,

                statementTimeoutMillis: 5000
            })


        client =
            await databaseClient.getClient()


        // Start isolated transaction
        await client.query("BEGIN")


        try {

            // Applies only to this transaction.
            await client.query(
                "SET LOCAL statement_timeout = '200ms'"
            )


            const timeoutResult =
                await client.query(
                    "SHOW statement_timeout"
                )


            expect(
                timeoutResult.rows[0].statement_timeout
            ).toBe("200ms")


            // Must be cancelled by PostgreSQL.
            await expect(
                client.query(
                    "SELECT pg_sleep(1)"
                )
            ).rejects.toMatchObject({
                code: "57014"
            })

        }
        finally {

            // Timeout cancellation aborts the transaction,
            // so rollback before returning connection to pool.
            await client.query("ROLLBACK")
        }
    })
})


// DI — timeout configuration is injected into PostgresDatabaseClient.
// Encapsulation — PostgreSQL timeout handling remains inside the database adapter.
// Integration Testing — verifies timeout behavior against real Neon PostgreSQL.
// Failure Handling — long-running queries are cancelled instead of running indefinitely.
// Resource Management — database pool is closed after every test.
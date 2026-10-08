
import {
    describe,
    it,
    expect,
    afterEach
} from "vitest";

import { createTestDatabase } from "../../helpers/testDatabase.js";

describe("PostgreSQL Query Timeout", () => {

    let databaseClient = null;
    let client = null;

    afterEach(async () => {
        if (client) {
            client.release();
            client = null;
        }

        if (databaseClient) {
            await databaseClient.disconnect();
            databaseClient = null;
        }
    });

    it("should cancel a query that exceeds the statement timeout", async () => {

        // Arrange: reuse the shared test database configuration.
        databaseClient = createTestDatabase();

        client = await databaseClient.getClient();

        // Start isolated transaction.
        await client.query("BEGIN");

        try {
            // Applies only to this transaction.
            await client.query(
                "SET LOCAL statement_timeout = '200ms'"
            );

            const timeoutResult = await client.query(
                "SHOW statement_timeout"
            );

            expect(
                timeoutResult.rows[0].statement_timeout
            ).toBe("200ms");

            // PostgreSQL must cancel the long-running query.
            await expect(
                client.query("SELECT pg_sleep(1)")
            ).rejects.toMatchObject({
                code: "57014"
            });

        } finally {
            // Query cancellation aborts the transaction.
            await client.query("ROLLBACK");
        }
    });
});

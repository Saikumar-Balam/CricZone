import {
    describe,
    it,
    expect,
    vi
} from "vitest"

import PostgresRetryStrategy
    from "../../../src/database/postgres/PostgresRetryStrategy.js"


describe("19.9.3 PostgreSQL Retry Strategy", () => {

    it("should execute operation once when it succeeds", async () => {

        // Arrange
        const retryStrategy =
            new PostgresRetryStrategy({
                maxRetries: 2,
                baseDelayMs: 0
            })

        const operation =
            vi.fn().mockResolvedValue("success")


        // Act
        const result =
            await retryStrategy.execute(operation)


        // Assert
        expect(result).toBe("success")

        expect(operation)
            .toHaveBeenCalledTimes(1)
    })


    it("should retry when a transient PostgreSQL error occurs", async () => {

        // Arrange
        const retryStrategy =
            new PostgresRetryStrategy({
                maxRetries: 2,
                baseDelayMs: 0
            })

        const transientError =
            Object.assign(
                new Error("Connection lost"),
                {
                    code: "08006"
                }
            )

        const operation =
            vi.fn()
                .mockRejectedValueOnce(
                    transientError
                )
                .mockResolvedValue(
                    "success"
                )


        // Act
        const result =
            await retryStrategy.execute(
                operation
            )


        // Assert
        expect(result)
            .toBe("success")

        expect(operation)
            .toHaveBeenCalledTimes(2)
    })


    it("should not retry non-retryable PostgreSQL errors", async () => {

        // Arrange
        const retryStrategy =
            new PostgresRetryStrategy({
                maxRetries: 2,
                baseDelayMs: 0
            })

        const uniqueViolation =
            Object.assign(
                new Error(
                    "Unique constraint violation"
                ),
                {
                    code: "23505"
                }
            )

        const operation =
            vi.fn()
                .mockRejectedValue(
                    uniqueViolation
                )


        // Act + Assert
        await expect(
            retryStrategy.execute(
                operation
            )
        ).rejects.toBe(
            uniqueViolation
        )

        expect(operation)
            .toHaveBeenCalledTimes(1)
    })


    it("should stop retrying after maximum retries are exhausted", async () => {

        // Arrange
        const retryStrategy =
            new PostgresRetryStrategy({
                maxRetries: 2,
                baseDelayMs: 0
            })

        const transientError =
            Object.assign(
                new Error(
                    "Database connection unavailable"
                ),
                {
                    code: "08006"
                }
            )

        const operation =
            vi.fn()
                .mockRejectedValue(
                    transientError
                )


        // Act + Assert
        await expect(
            retryStrategy.execute(
                operation
            )
        ).rejects.toBe(
            transientError
        )

        expect(operation)
            .toHaveBeenCalledTimes(3)
    })

})

// Strategy Pattern — retry policy is isolated in PostgresRetryStrategy.
// SRP — retry decisions are separate from repositories and DB operations.
// OCP — retry behavior can be changed without modifying repositories.
// DIP — PostgresDatabaseClient can depend on an injected retry strategy.
// Failure Isolation — only transient infrastructure errors are retried.
// Test Isolation — no real Neon connection is required.

import RetryStrategy from "../contracts/RetryStrategy.js";

export default class PostgresRetryStrategy extends RetryStrategy {
    constructor({ maxRetries = 2, baseDelayMs = 200 } = {}) {
        super();

        this.maxRetries = maxRetries;
        this.baseDelayMs = baseDelayMs;
    }

    async execute(operation) {
        let attempt = 0;

        while (true) {
            try {
                return await operation();
            } catch (error) {
                if (
                    !this.isRetryable(error) ||
                    attempt >= this.maxRetries
                ) {
                    throw error;
                }

                attempt++;

                await this.delay(
                    this.baseDelayMs * attempt
                );
            }
        }
    }

    isRetryable(error) {
        const retryableCodes = new Set([
            // PostgreSQL connection exception class
            "08000",
            "08001",
            "08003",
            "08004",
            "08006",
            "08007",
            "08P01",

            // PostgreSQL shutdown / unavailable
            "57P01",
            "57P02",
            "57P03",

            // Node.js transient network errors
            "ECONNREFUSED",
            "ECONNRESET",
            "ETIMEDOUT",
            "EPIPE",
            "EHOSTUNREACH",
            "ENETUNREACH",
            "EAI_AGAIN"
        ]);

        return retryableCodes.has(error?.code);
    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}


// Strategy Pattern — retry algorithm is replaceable.
// OCP — retry behavior can change without rewriting repositories.
// DIP — database client depends on retry abstraction/policy.
// Constructor DI — retry strategy is injected.
// SRP — retry decisions don't belong in repositories.
// Fail Fast — non-transient errors are immediately propagated.
// Explicit Replay Safety — write operations aren't automatically retried.
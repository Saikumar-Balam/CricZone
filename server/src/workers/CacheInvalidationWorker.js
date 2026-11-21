
export default class CacheInvalidationWorker {
  constructor(databaseClient, redisClient, logger) {
    this.databaseClient = databaseClient;
    this.redisClient = redisClient;
    this.logger = logger;

    // Retry configuration
    this.consecutiveFailures = 0;
    this.nextRetryAt = 0;

    this.baseRetryDelayMs = 1000;
    this.maxRetryDelayMs = 30000;

    // Deadline for an individual Redis deletion attempt
    this.redisOperationTimeoutMs = 3000;
  }

  calculateRetryDelay() {
    const exponent = Math.min(
      Math.max(this.consecutiveFailures - 1, 0),
      10
    );

    return Math.min(
      this.baseRetryDelayMs * 2 ** exponent,
      this.maxRetryDelayMs
    );
  }

  recordFailure() {
    this.consecutiveFailures += 1;

    const retryDelayMs = this.calculateRetryDelay();

    this.nextRetryAt = Date.now() + retryDelayMs;

    return retryDelayMs;
  }

  resetRetryState() {
    this.consecutiveFailures = 0;
    this.nextRetryAt = 0;
  }

  isRetryAllowed() {
    return Date.now() >= this.nextRetryAt;
  }

  validateCacheKeys(keys) {
    return (
      Array.isArray(keys) &&
      keys.length > 0 &&
      keys.every(
        (key) =>
          typeof key === "string" &&
          key.length > 0
      )
    );
  }

  /*
   * Delete cache keys using a dedicated Redis connection.
   *
   * The dedicated connection is destroyed after completion
   * or timeout, without affecting the application's shared
   * Redis connection.
   *
   * Redis DEL is idempotent, so retrying an uncertain
   * deletion is safe.
   */
  async deleteCacheKeys(keys) {
    if (!this.validateCacheKeys(keys)) {
      throw new Error("Invalid cache keys in outbox event");
    }

    /*
     * Compatibility with existing lightweight unit mocks.
     *
     * This fallback does not enforce a deletion deadline.
     * Production must provide a real node-redis client
     * supporting duplicate().
     */
    if (typeof this.redisClient.duplicate !== "function") {
      if (typeof this.redisClient.del !== "function") {
        throw new Error("Invalid Redis client");
      }

      return this.redisClient.del(keys);
    }

    if (this.redisClient.isReady === false) {
      throw new Error(
        "Redis is not ready for cache invalidation"
      );
    }

    const deletionClient = this.redisClient.duplicate({
  disableOfflineQueue: true,
  socket: {
    connectTimeout: 2000,
    reconnectStrategy: false
  }
});

    deletionClient.on("error", (error) => {
      this.logger.error("Dedicated Redis client error", {
        errorMessage: error.message
      });
    });

    let timeoutHandle = null;

    const operation = async () => {
      await deletionClient.connect();

      if (!deletionClient.isReady) {
        throw new Error(
          "Dedicated Redis connection is not ready"
        );
      }

      return deletionClient.del(keys);
    };

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        try {
          deletionClient.destroy();
        } catch (destroyError) {
          this.logger.error(
            "Failed to destroy timed-out Redis connection",
            {
              errorMessage: destroyError.message
            }
          );
        }

        reject(
          new Error(
            `Redis cache deletion exceeded ${this.redisOperationTimeoutMs}ms`
          )
        );
      }, this.redisOperationTimeoutMs);
    });

    try {
      return await Promise.race([
        operation(),
        timeoutPromise
      ]);
    } finally {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }

      // Never return this connection to a shared client pool.
      if (deletionClient.isOpen) {
        deletionClient.destroy();
      }
    }
  }

  async processOne() {
    if (!this.isRetryAllowed()) {
      return false;
    }

    let client = null;
    let event = null;

    let transactionStarted = false;
    let commitAttempted = false;
    let discardConnection = false;

    try {
      client = await this.databaseClient.getClient();

      await client.query("BEGIN");
      transactionStarted = true;
      await client.query(
  "SET LOCAL idle_in_transaction_session_timeout = '15s'"
);

      const result = await client.query(`
        SELECT id, cache_keys
        FROM public.cache_invalidation_outbox
        WHERE status = 'PENDING'
        ORDER BY created_at, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);

      event = result.rows[0];

      // Nothing to process.
      if (!event) {
        commitAttempted = true;

        await client.query("COMMIT");

        transactionStarted = false;
        commitAttempted = false;

        this.resetRetryState();

        return false;
      }

      const keys = event.cache_keys;

      if (!this.validateCacheKeys(keys)) {
        throw new Error(
          "Invalid cache keys in outbox event"
        );
      }

      /*
       * Delete the cache entries before marking the
       * corresponding outbox event as completed.
       *
       * If deletion fails, the database transaction
       * must not commit the COMPLETED status.
       */
      await this.deleteCacheKeys(keys);

      await client.query(
        `
          UPDATE public.cache_invalidation_outbox
          SET status = 'COMPLETED',
              processed_at = NOW()
          WHERE id = $1
            AND status = 'PENDING'
        `,
        [event.id]
      );

      /*
       * COMMIT is the transaction's acknowledgement boundary.
       *
       * If this throws because of a lost connection,
       * PostgreSQL may or may not have committed.
       *
       * Never assume a failed acknowledgement means
       * the transaction was rolled back.
       */
      commitAttempted = true;

      await client.query("COMMIT");

      transactionStarted = false;
      commitAttempted = false;

      this.resetRetryState();

      this.logger.info(
        "Cache invalidation completed",
        {
          outboxId: event.id,
          keyCount: keys.length
        }
      );

      return true;
    } catch (error) {
      let rollbackConfirmed = false;

      /*
       * Only attempt rollback when COMMIT has not
       * already been attempted.
       */
      if (
        client &&
        transactionStarted &&
        !commitAttempted
      ) {
        try {
          await client.query("ROLLBACK");

          rollbackConfirmed = true;
          transactionStarted = false;
        } catch (rollbackError) {
          discardConnection = true;

          this.logger.error(
            "Outbox rollback failed",
            {
              outboxId: event?.id ?? null,
              errorMessage: rollbackError.message
            }
          );
        }
      }

      /*
       * An error during COMMIT creates uncertainty.
       *
       * Discard the connection instead of returning it
       * to the PostgreSQL pool.
       *
       * A later worker iteration will check the durable
       * outbox status again.
       */
      if (commitAttempted) {
        discardConnection = true;

        this.logger.error(
          "Outbox commit outcome uncertain",
          {
            outboxId: event?.id ?? null,
            errorMessage: error.message
          }
        );
      }

      /*
       * Increment attempts only when rollback is confirmed.
       *
       * Never issue the attempt-counter update through
       * an uncertain or still-active transaction.
       */
      if (event && rollbackConfirmed) {
        try {
          await this.databaseClient.query(
            `
              UPDATE public.cache_invalidation_outbox
              SET attempts = attempts + 1
              WHERE id = $1
                AND status = 'PENDING'
            `,
            [event.id]
          );
        } catch (attemptError) {
          this.logger.error(
            "Failed to record outbox attempt",
            {
              outboxId: event.id,
              errorMessage: attemptError.message
            }
          );
        }
      }

      const retryDelayMs = this.recordFailure();

      this.logger.error(
        "Cache invalidation failed",
        {
          outboxId: event?.id ?? null,
          errorMessage: error.message,
          consecutiveFailures: this.consecutiveFailures,
          retryDelayMs,
          commitOutcomeUncertain: commitAttempted
        }
      );

      return false;
    } finally {
      if (client) {
        /*
         * release(true) removes a potentially broken
         * PostgreSQL connection from the pool.
         */
        client.release(discardConnection);
      }
    }
  }

  async processBatch(batchSize = 50) {
    if (
      !Number.isSafeInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > 1000
    ) {
      throw new Error("Invalid outbox batch size");
    }

    if (!this.isRetryAllowed()) {
      return 0;
    }

    let processed = 0;

    for (let i = 0; i < batchSize; i++) {
      const success = await this.processOne();

      if (!success) {
        break;
      }

      processed += 1;
    }

    return processed;
  }
}

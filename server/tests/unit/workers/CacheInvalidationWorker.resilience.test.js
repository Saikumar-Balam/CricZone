
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach
} from "vitest";

import CacheInvalidationWorker from
  "../../../src/workers/CacheInvalidationWorker.js";

import ApplicationBootstrap from
  "../../../src/bootstrap/ApplicationBootstrap.js";

describe("CacheInvalidationWorker resilience", () => {
  let worker;
  let databaseClient;
  let postgresClient;
  let redisClient;
  let deletionClient;
  let logger;

  const event = {
    id: 1,
    cache_keys: ["test:match:2", "test:scorecard:2"]
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));

    postgresClient = {
      query: vi.fn(async (sql) => {
        if (sql.includes("SELECT id, cache_keys")) {
          return { rows: [event] };
        }

        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn()
    };

    databaseClient = {
      getClient: vi.fn(async () => postgresClient),
      query: vi.fn(async () => ({ rowCount: 1 }))
    };

    deletionClient = {
      isReady: true,
      isOpen: true,
      on: vi.fn(),
      connect: vi.fn(async () => undefined),
      del: vi.fn(async () => 2),
      destroy: vi.fn()
    };

    redisClient = {
      isReady: true,
      duplicate: vi.fn(() => deletionClient)
    };

    logger = {
      info: vi.fn(),
      error: vi.fn()
    };

    worker = new CacheInvalidationWorker(
      databaseClient,
      redisClient,
      logger
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rejects deletion when Redis is unavailable", async () => {
    redisClient.isReady = false;

    const result = await worker.processOne();

    expect(result).toBe(false);

    expect(redisClient.duplicate)
      .not.toHaveBeenCalled();

    expect(postgresClient.query)
      .toHaveBeenCalledWith("ROLLBACK");

    expect(databaseClient.query)
      .toHaveBeenCalledTimes(1);

    expect(worker.consecutiveFailures).toBe(1);
    expect(worker.nextRetryAt).toBe(Date.now() + 1000);

    expect(postgresClient.release)
      .toHaveBeenCalledTimes(1);
  });

  it("times out a stalled Redis deletion", async () => {
    deletionClient.del.mockImplementation(
      () => new Promise(() => {})
    );

    const processing = worker.processOne();

    await vi.advanceTimersByTimeAsync(3000);

    const result = await processing;

    expect(result).toBe(false);

    expect(deletionClient.destroy)
      .toHaveBeenCalled();

    expect(postgresClient.query)
      .toHaveBeenCalledWith("ROLLBACK");

    const completedQuery = postgresClient.query.mock.calls
      .some(([sql]) => sql.includes("SET status = 'COMPLETED'"));

    expect(completedQuery).toBe(false);

    expect(worker.consecutiveFailures).toBe(1);
  });

  it("applies exponential backoff after failures", async () => {
    redisClient.isReady = false;

    // First failure: 1 second.
    expect(await worker.processOne()).toBe(false);
    expect(worker.consecutiveFailures).toBe(1);

    const callsAfterFirstFailure =
      databaseClient.getClient.mock.calls.length;

    // Immediate retry must not query PostgreSQL.
    expect(await worker.processOne()).toBe(false);

    expect(databaseClient.getClient.mock.calls.length)
      .toBe(callsAfterFirstFailure);

    await vi.advanceTimersByTimeAsync(1000);

    // Second failure: 2 seconds.
    expect(await worker.processOne()).toBe(false);
    expect(worker.consecutiveFailures).toBe(2);
    expect(worker.nextRetryAt).toBe(Date.now() + 2000);

    await vi.advanceTimersByTimeAsync(2000);

    // Third failure: 4 seconds.
    expect(await worker.processOne()).toBe(false);
    expect(worker.consecutiveFailures).toBe(3);
    expect(worker.nextRetryAt).toBe(Date.now() + 4000);
  });

  it("resets backoff after successful recovery", async () => {
    redisClient.isReady = false;

    // Simulate an outage.
    expect(await worker.processOne()).toBe(false);
    expect(worker.consecutiveFailures).toBe(1);

    // Wait for retry eligibility.
    await vi.advanceTimersByTimeAsync(1000);

    // Redis has recovered.
    redisClient.isReady = true;

    const result = await worker.processOne();

    expect(result).toBe(true);

    expect(deletionClient.del)
      .toHaveBeenCalledWith(event.cache_keys);

    expect(postgresClient.query)
      .toHaveBeenCalledWith("COMMIT");

    expect(worker.consecutiveFailures).toBe(0);
    expect(worker.nextRetryAt).toBe(0);

    expect(logger.info)
      .toHaveBeenCalled();
  });

  it("waits for an active batch during shutdown", async () => {
    let finishBatch;

    const pendingBatch = new Promise((resolve) => {
      finishBatch = resolve;
    });

    const batchSpy = vi
      .spyOn(CacheInvalidationWorker.prototype, "processBatch")
      .mockImplementation(() => pendingBatch);

    const appDatabase = {
      disconnect: vi.fn(async () => undefined)
    };

    const appRedis = {
      isOpen: true,
      disconnect: vi.fn(async () => undefined)
    };

    const bootstrap = new ApplicationBootstrap(
      {},
      appDatabase,
      appRedis,
      { disconnect: vi.fn(async () => undefined) },
      { disconnect: vi.fn(async () => undefined) },
      { disconnect: vi.fn(async () => undefined) },
      {},
      5000
    );

    vi.spyOn(console, "log").mockImplementation(() => {});

    bootstrap.startOutboxWorker();

    await vi.advanceTimersByTimeAsync(0);

    expect(batchSpy).toHaveBeenCalledTimes(1);

    const shutdown = bootstrap.stop();

    expect(appRedis.disconnect)
      .not.toHaveBeenCalled();

    expect(appDatabase.disconnect)
      .not.toHaveBeenCalled();

    finishBatch(1);

    await shutdown;

    expect(appRedis.disconnect)
      .toHaveBeenCalledTimes(1);

    expect(appDatabase.disconnect)
      .toHaveBeenCalledTimes(1);

    expect(bootstrap.cacheInvalidationWorker)
      .toBeNull();
  });

it("discards the PostgreSQL connection when COMMIT outcome is uncertain", async () => {
  postgresClient.query.mockImplementation(async (sql) => {
    if (sql.includes("SELECT id, cache_keys")) {
      return { rows: [event] };
    }

    if (sql === "COMMIT") {
      throw new Error("Connection lost during COMMIT");
    }

    return { rows: [], rowCount: 1 };
  });

  const result = await worker.processOne();

  expect(result).toBe(false);

  // Redis deletion was acknowledged before COMMIT.
  expect(deletionClient.del)
    .toHaveBeenCalledWith(event.cache_keys);

  // A failed COMMIT acknowledgement is not proof of rollback.
  expect(postgresClient.query)
    .not.toHaveBeenCalledWith("ROLLBACK");

  // Never reuse a connection with uncertain transaction state.
  expect(postgresClient.release)
    .toHaveBeenCalledWith(true);

  // Do not increment attempts based on an assumed rollback.
  expect(databaseClient.query)
    .not.toHaveBeenCalled();

  // Never report a successful completion.
  expect(logger.info)
    .not.toHaveBeenCalled();

  expect(logger.error).toHaveBeenCalledWith(
    "Outbox commit outcome uncertain",
    expect.objectContaining({
      outboxId: event.id
    })
  );

  expect(worker.consecutiveFailures).toBe(1);
});

it("uses a dedicated Redis client without automatic reconnection", async () => {
  const result = await worker.processOne();

  expect(result).toBe(true);

  expect(redisClient.duplicate).toHaveBeenCalledWith({
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 2000,
      reconnectStrategy: false
    }
  });

  expect(deletionClient.connect).toHaveBeenCalledTimes(1);

  expect(deletionClient.del).toHaveBeenCalledWith(
    event.cache_keys
  );

  expect(deletionClient.destroy).toHaveBeenCalled();

  expect(worker.consecutiveFailures).toBe(0);
});


it("aborts infrastructure teardown when the worker exceeds the shutdown deadline", async () => {
  // Simulate an outbox batch that never finishes.
  const batchSpy = vi
    .spyOn(CacheInvalidationWorker.prototype, "processBatch")
    .mockImplementation(() => new Promise(() => {}));

  const appDatabase = {
    disconnect: vi.fn().mockResolvedValue(undefined)
  };

  const appRedis = {
    isOpen: true,
    disconnect: vi.fn().mockResolvedValue(undefined)
  };

  const bootstrap = new ApplicationBootstrap(
    {},
    appDatabase,
    appRedis,
    { disconnect: vi.fn().mockResolvedValue(undefined) },
    { disconnect: vi.fn().mockResolvedValue(undefined) },
    { disconnect: vi.fn().mockResolvedValue(undefined) },
    {},
    5000
  );

  bootstrap.startOutboxWorker();

  // Allow the initial polling timer to start the batch.
  await vi.advanceTimersByTimeAsync(0);

  expect(batchSpy).toHaveBeenCalledTimes(1);

  // Attach the rejection assertion before advancing timers.
  const shutdown = bootstrap.stop();
  const shutdownRejected = expect(shutdown).rejects.toThrow(
    "Cache invalidation worker did not stop within 15000ms"
  );

  await vi.advanceTimersByTimeAsync(15000);
  await shutdownRejected;

  // The worker has not actually stopped.
  expect(bootstrap.outboxStopping).toBe(true);
  expect(bootstrap.cacheInvalidationWorker).not.toBeNull();

  // Infrastructure must not be disconnected under an active worker.
  expect(appDatabase.disconnect).not.toHaveBeenCalled();
  expect(appRedis.disconnect).not.toHaveBeenCalled();

  // No new batches should start after shutdown begins.
  await vi.advanceTimersByTimeAsync(5000);
  expect(batchSpy).toHaveBeenCalledTimes(1);
});

});

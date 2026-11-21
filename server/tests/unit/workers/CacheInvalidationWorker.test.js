
import { describe, expect, it, vi } from "vitest";

import CacheInvalidationWorker from
  "../../../src/workers/CacheInvalidationWorker.js";

function setup({ redisFails = false, empty = false } = {}) {
  const client = {
    release: vi.fn(),
    query: vi.fn(async (sql) => {
      const statement = sql.trim().toUpperCase();

      if (statement.startsWith("SELECT")) {
        return {
          rows: empty
            ? []
            : [{
                id: 1,
                cache_keys: [
                  "match:123",
                  "scorecard:123"
                ]
              }]
        };
      }

      return { rows: [], rowCount: 1 };
    })
  };

  const database = {
    getClient: vi.fn().mockResolvedValue(client),
    query: vi.fn().mockResolvedValue({
      rowCount: 1
    })
  };

  const redis = {
    del: redisFails
      ? vi.fn().mockRejectedValue(
          new Error("Valkey unavailable")
        )
      : vi.fn().mockResolvedValue(2)
  };

  const logger = {
    info: vi.fn(),
    error: vi.fn()
  };

  return {
    worker: new CacheInvalidationWorker(
      database,
      redis,
      logger
    ),
    database,
    redis,
    client
  };
}

describe("CacheInvalidationWorker", () => {
  it("deletes keys and completes the outbox event", async () => {
    const { worker, redis, client } = setup();

    const processed = await worker.processOne();

    expect(processed).toBe(true);

    expect(redis.del).toHaveBeenCalledWith([
      "match:123",
      "scorecard:123"
    ]);

    const sql = client.query.mock.calls.map(
      ([query]) => query.trim().toUpperCase()
    );

    expect(sql.some(
      query => query.includes("SET STATUS = 'COMPLETED'")
    )).toBe(true);

    expect(sql.at(-1)).toBe("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("preserves pending events when Valkey fails", async () => {
    const { worker, database, client } = setup({
      redisFails: true
    });

    const processed = await worker.processOne();

    expect(processed).toBe(false);

    const sql = client.query.mock.calls.map(
      ([query]) => query.trim().toUpperCase()
    );

    expect(sql).toContain("ROLLBACK");
    expect(sql).not.toContain("COMMIT");

    expect(database.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("returns false when no pending events exist", async () => {
    const { worker, redis } = setup({
      empty: true
    });

    expect(await worker.processOne()).toBe(false);
    expect(redis.del).not.toHaveBeenCalled();
  });
});

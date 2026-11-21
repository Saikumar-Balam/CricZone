
import { describe, expect, it, vi } from "vitest";

import MatchService from
  "../../../src/services/MatchService.js";

describe("MatchService outbox consistency", () => {
  it("bypasses stale cache when invalidation is pending", async () => {
    const stale = { id: 123, version: 1 };
    const fresh = { id: 123, version: 2 };

    const matchRepository = {
      findById: vi.fn().mockResolvedValue(fresh)
    };

    const cache = {
      get: vi.fn().mockResolvedValue(stale),
      set: vi.fn()
    };

    const invalidationRepository = {
      hasPendingInvalidation: vi.fn().mockResolvedValue(true)
    };

    const service = new MatchService(
      matchRepository,
      cache,
      invalidationRepository
    );

    const result = await service.getMatchById(123);

    expect(result).toEqual(fresh);
    expect(cache.get).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
    expect(matchRepository.findById).toHaveBeenCalledWith(123);
  });

  it("returns cached data when no invalidation is pending", async () => {
    const cached = { id: 123, version: 2 };

    const matchRepository = {
      findById: vi.fn()
    };

    const cache = {
      get: vi.fn().mockResolvedValue(cached),
      set: vi.fn()
    };

    const invalidationRepository = {
      hasPendingInvalidation: vi.fn().mockResolvedValue(false)
    };

    const service = new MatchService(
      matchRepository,
      cache,
      invalidationRepository
    );

    const result = await service.getMatchById(123);

    expect(result).toEqual(cached);
    expect(matchRepository.findById).not.toHaveBeenCalled();
  });

  it("does not serve stale cache when the outbox check fails", async () => {
    const matchRepository = {
      findById: vi.fn()
    };

    const cache = {
      get: vi.fn()
    };

    const invalidationRepository = {
      hasPendingInvalidation: vi.fn().mockRejectedValue(
        new Error("PostgreSQL unavailable")
      )
    };

    const service = new MatchService(
      matchRepository,
      cache,
      invalidationRepository
    );

    await expect(
      service.getMatchById(123)
    ).rejects.toThrow("PostgreSQL unavailable");

    expect(cache.get).not.toHaveBeenCalled();
  });
});

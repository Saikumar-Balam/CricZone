import { beforeEach, describe, expect, it, vi } from "vitest";

import MatchService from "../../../src/services/MatchService.js";
import MatchNotFoundError from "../../../src/errors/MatchNotFoundError.js";
import { CacheKeys } from "../../../src/cache/CacheKeys.js";
import { CacheTTL } from "../../../src/cache/CacheTTL.js";

describe("MatchService", () => {
    let matchRepository;
    let cache;
    let matchService;

    beforeEach(() => {
        matchRepository = {
            findAll: vi.fn(),
            findById: vi.fn()
        };

        cache = {
            get: vi.fn(),
            set: vi.fn()
        };

        matchService = new MatchService(
            matchRepository,
            cache
        );

        vi.clearAllMocks();
    });

    describe("getMatches()", () => {
        it("should return all matches from repository", async () => {
            const matches = [
                {
                    id: 1,
                    team1: "India",
                    team2: "Australia"
                },
                {
                    id: 2,
                    team1: "England",
                    team2: "South Africa"
                }
            ];

            matchRepository.findAll.mockResolvedValue(matches);

            const result = await matchService.getMatches();

            expect(matchRepository.findAll).toHaveBeenCalledTimes(1);
            expect(result).toEqual(matches);
        });

        it("should propagate repository failure", async () => {
            const error = new Error("Database failure");

            matchRepository.findAll.mockRejectedValue(error);

            await expect(
                matchService.getMatches()
            ).rejects.toThrow("Database failure");
        });
    });

    describe("getMatchById()", () => {
        it("should return match from cache on cache hit", async () => {
            const matchId = 1;

            const cachedMatch = {
                id: matchId,
                team1: "India",
                team2: "Australia"
            };

            const cacheKey = CacheKeys.matchById(matchId);

            cache.get.mockResolvedValue(cachedMatch);

            const result = await matchService.getMatchById(matchId);

            expect(cache.get).toHaveBeenCalledWith(cacheKey);

            expect(matchRepository.findById)
                .not.toHaveBeenCalled();

            expect(cache.set)
                .not.toHaveBeenCalled();

            expect(result).toEqual(cachedMatch);
        });

        it("should fetch match from repository on cache miss", async () => {
            const matchId = 1;

            const match = {
                id: matchId,
                team1: "India",
                team2: "Australia"
            };

            const cacheKey = CacheKeys.matchById(matchId);

            cache.get.mockResolvedValue(null);
            matchRepository.findById.mockResolvedValue(match);

            const result = await matchService.getMatchById(matchId);

            expect(cache.get)
                .toHaveBeenCalledWith(cacheKey);

            expect(matchRepository.findById)
                .toHaveBeenCalledWith(matchId);

            expect(result).toEqual(match);
        });

        it("should cache repository result on cache miss", async () => {
            const matchId = 1;

            const match = {
                id: matchId,
                team1: "India",
                team2: "Australia"
            };

            const cacheKey = CacheKeys.matchById(matchId);

            cache.get.mockResolvedValue(null);
            matchRepository.findById.mockResolvedValue(match);

            await matchService.getMatchById(matchId);

            expect(cache.set).toHaveBeenCalledWith(
                cacheKey,
                match,
                CacheTTL.MATCH
            );

            expect(cache.set).toHaveBeenCalledTimes(1);
        });

        it("should throw MatchNotFoundError when match does not exist", async () => {
            const matchId = 999;

            const cacheKey = CacheKeys.matchById(matchId);

            cache.get.mockResolvedValue(null);
            matchRepository.findById.mockResolvedValue(null);

            await expect(
                matchService.getMatchById(matchId)
            ).rejects.toBeInstanceOf(MatchNotFoundError);

            expect(cache.get)
                .toHaveBeenCalledWith(cacheKey);

            expect(matchRepository.findById)
                .toHaveBeenCalledWith(matchId);

            expect(cache.set)
                .not.toHaveBeenCalled();
        });

        it("should propagate cache get failure", async () => {
            cache.get.mockRejectedValue(
                new Error("Redis unavailable")
            );

            await expect(
                matchService.getMatchById(1)
            ).rejects.toThrow("Redis unavailable");

            expect(matchRepository.findById)
                .not.toHaveBeenCalled();
        });

        it("should propagate repository failure after cache miss", async () => {
            cache.get.mockResolvedValue(null);

            matchRepository.findById.mockRejectedValue(
                new Error("Database unavailable")
            );

            await expect(
                matchService.getMatchById(1)
            ).rejects.toThrow("Database unavailable");

            expect(cache.set)
                .not.toHaveBeenCalled();
        });

        it("should propagate cache set failure", async () => {
            const match = {
                id: 1,
                team1: "India",
                team2: "Australia"
            };

            cache.get.mockResolvedValue(null);
            matchRepository.findById.mockResolvedValue(match);

            cache.set.mockRejectedValue(
                new Error("Redis write failure")
            );

            await expect(
                matchService.getMatchById(1)
            ).rejects.toThrow("Redis write failure");
        });
    });
});
// SRP — MatchService tests only service/business behavior.
// DIP — tests mock the repository/cache abstractions rather than PostgreSQL or Redis.
// Dependency Injection — mocks are constructor-injected into MatchService.
// LSP — mock repository/cache implementations substitute the real implementations.
// Service Layer Pattern — tests business use cases independently of controllers.
// Cache-Aside Pattern — explicitly verifies cache hit → no DB and cache miss → DB → cache.
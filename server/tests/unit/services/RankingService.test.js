import { beforeEach, describe, expect, it, vi } from "vitest";

import RankingService from "../../../src/services/RankingService.js";
import RankingNotFoundError from "../../../src/errors/RankingNotFoundError.js";

describe("RankingService", () => {
    let rankingRepository;
    let rankingService;

    beforeEach(() => {
        rankingRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findPlayerRankings: vi.fn(),
            findTeamRankings: vi.fn()
        };

        rankingService = new RankingService(rankingRepository);

        vi.clearAllMocks();
    });

    describe("getRankings()", () => {
        it("should return all rankings", async () => {
            const rankings = [
                { id: 1, format: "ODI", rank: 1 },
                { id: 2, format: "TEST", rank: 2 }
            ];

            rankingRepository.findAll.mockResolvedValue(rankings);

            const result = await rankingService.getRankings();

            expect(rankingRepository.findAll)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(rankings);
        });
    });

    describe("getRankingsById()", () => {
        it("should return ranking when ranking exists", async () => {
            const ranking = {
                id: 1,
                format: "ODI",
                rank: 1
            };

            rankingRepository.findById.mockResolvedValue(ranking);

            const result =
                await rankingService.getRankingsById(1);

            expect(rankingRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(ranking);
        });

        it("should throw RankingNotFoundError when ranking does not exist", async () => {
            rankingRepository.findById.mockResolvedValue(null);

            await expect(
                rankingService.getRankingsById(999)
            ).rejects.toBeInstanceOf(RankingNotFoundError);

            expect(rankingRepository.findById)
                .toHaveBeenCalledWith(999);
        });
    });

    describe("getPlayerRankings()", () => {
        it("should return player rankings", async () => {
            const rankings = [
                {
                    playerId: 1,
                    playerName: "Virat Kohli",
                    format: "ODI",
                    rank: 1
                }
            ];

            rankingRepository.findPlayerRankings
                .mockResolvedValue(rankings);

            const result =
                await rankingService.getPlayerRankings();

            expect(rankingRepository.findPlayerRankings)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(rankings);
        });
    });

    describe("getTeamRankings()", () => {
        it("should return team rankings", async () => {
            const rankings = [
                {
                    teamId: 1,
                    teamName: "India",
                    format: "TEST",
                    rank: 1
                }
            ];

            rankingRepository.findTeamRankings
                .mockResolvedValue(rankings);

            const result =
                await rankingService.getTeamRankings();

            expect(rankingRepository.findTeamRankings)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(rankings);
        });
    });
});
// SRP — RankingService handles ranking use cases only.
// DIP — depends on the ranking repository abstraction.
// Dependency Injection — repository supplied through the constructor.
// LSP — mocked repository can substitute the real PostgreSQL implementation.
// OCP — repository implementation can change without modifying the service.
// Service Layer Pattern — business/application logic remains separate from controller and persistence.
// Repository Pattern — data-access operations remain behind rankingRepository.
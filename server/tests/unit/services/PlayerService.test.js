import { beforeEach, describe, expect, it, vi } from "vitest";

import PlayerService from "../../../src/services/PlayerService.js";
import PlayerNotFoundError from "../../../src/errors/PlayerNotFoundError.js";

describe("PlayerService", () => {
    let playerRepository;
    let playerService;

    beforeEach(() => {
        playerRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findStatisticsByPlayerId: vi.fn(),
            findRankingByPlayerId: vi.fn(),
            findNewsByPlayerId: vi.fn()
        };

        playerService = new PlayerService(playerRepository);

        vi.clearAllMocks();
    });

    describe("getPlayers()", () => {
        it("should return all players", async () => {
            const players = [
                { id: 1, name: "Virat Kohli" },
                { id: 2, name: "Rohit Sharma" }
            ];

            playerRepository.findAll.mockResolvedValue(players);

            const result = await playerService.getPlayers();

            expect(playerRepository.findAll)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(players);
        });
    });

    describe("getPlayersById()", () => {
        it("should return player when player exists", async () => {
            const player = {
                id: 1,
                name: "Virat Kohli"
            };

            playerRepository.findById.mockResolvedValue(player);

            const result =
                await playerService.getPlayersById(1);

            expect(playerRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(player);
        });

        it("should throw PlayerNotFoundError when player does not exist", async () => {
            playerRepository.findById.mockResolvedValue(null);

            await expect(
                playerService.getPlayersById(999)
            ).rejects.toBeInstanceOf(PlayerNotFoundError);
        });
    });

    describe("getStatisticsByPlayerId()", () => {
        it("should return statistics when player exists", async () => {
            const player = {
                id: 1,
                name: "Virat Kohli"
            };

            const statistics = {
                runs: 12000,
                wickets: 5
            };

            playerRepository.findById.mockResolvedValue(player);

            playerRepository.findStatisticsByPlayerId
                .mockResolvedValue(statistics);

            const result =
                await playerService.getStatisticsByPlayerId(1);

            expect(playerRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(playerRepository.findStatisticsByPlayerId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(statistics);
        });

        it("should throw PlayerNotFoundError and not query statistics when player does not exist", async () => {
            playerRepository.findById.mockResolvedValue(null);

            await expect(
                playerService.getStatisticsByPlayerId(999)
            ).rejects.toBeInstanceOf(PlayerNotFoundError);

            expect(playerRepository.findStatisticsByPlayerId)
                .not.toHaveBeenCalled();
        });
    });

    describe("getRankingByPlayerId()", () => {
        it("should return ranking when player exists", async () => {
            const player = {
                id: 1,
                name: "Virat Kohli"
            };

            const ranking = {
                format: "ODI",
                rank: 2
            };

            playerRepository.findById.mockResolvedValue(player);

            playerRepository.findRankingByPlayerId
                .mockResolvedValue(ranking);

            const result =
                await playerService.getRankingByPlayerId(1);

            expect(playerRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(playerRepository.findRankingByPlayerId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(ranking);
        });

        it("should throw PlayerNotFoundError and not query ranking when player does not exist", async () => {
            playerRepository.findById.mockResolvedValue(null);

            await expect(
                playerService.getRankingByPlayerId(999)
            ).rejects.toBeInstanceOf(PlayerNotFoundError);

            expect(playerRepository.findRankingByPlayerId)
                .not.toHaveBeenCalled();
        });
    });

    describe("getNewsByPlayerId()", () => {
        it("should return news when player exists", async () => {
            const player = {
                id: 1,
                name: "Virat Kohli"
            };

            const news = [
                {
                    id: 100,
                    title: "Player reaches milestone"
                }
            ];

            playerRepository.findById.mockResolvedValue(player);

            playerRepository.findNewsByPlayerId
                .mockResolvedValue(news);

            const result =
                await playerService.getNewsByPlayerId(1);

            expect(playerRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(playerRepository.findNewsByPlayerId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(news);
        });

        it("should throw PlayerNotFoundError and not query news when player does not exist", async () => {
            playerRepository.findById.mockResolvedValue(null);

            await expect(
                playerService.getNewsByPlayerId(999)
            ).rejects.toBeInstanceOf(PlayerNotFoundError);

            expect(playerRepository.findNewsByPlayerId)
                .not.toHaveBeenCalled();
        });
    });

    describe("ensurePlayerExists()", () => {
        it("should return player when player exists", async () => {
            const player = {
                id: 1,
                name: "Virat Kohli"
            };

            playerRepository.findById.mockResolvedValue(player);

            const result =
                await playerService.ensurePlayerExists(1);

            expect(playerRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(player);
        });

        it("should throw PlayerNotFoundError when player does not exist", async () => {
            playerRepository.findById.mockResolvedValue(null);

            await expect(
                playerService.ensurePlayerExists(999)
            ).rejects.toBeInstanceOf(PlayerNotFoundError);
        });
    });
});

// SRP — PlayerService handles player application/business use cases.
// DIP — service depends on the repository abstraction, not PostgreSQL.
// Dependency Injection — repository is constructor-injected.
// LSP — mocked repository substitutes the real implementation.
// OCP — repository implementation can change without changing PlayerService.
// Service Layer Pattern — business orchestration remains separate from HTTP and persistence.
// Repository Pattern — database operations remain behind playerRepository.
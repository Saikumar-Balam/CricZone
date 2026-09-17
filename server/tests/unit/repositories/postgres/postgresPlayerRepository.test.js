import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresPlayerRepository
    from "../../../../src/repositories/postgres/postgresPlayerRepository.js";

describe("PostgresPlayerRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository = new PostgresPlayerRepository(databaseClient);
    });

    describe("findAll()", () => {
        it("should execute query and return all players", async () => {
            const players = [
                {
                    id: 1,
                    name: "Virat Kohli",
                    country: "India",
                    role: "Batter",
                    teams: []
                },
                {
                    id: 2,
                    name: "Jasprit Bumrah",
                    country: "India",
                    role: "Bowler",
                    teams: []
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: players
            });

            const result = await repository.findAll();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("FROM players p")
                );

            expect(result).toEqual(players);
        });

        it("should return empty array when no players exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result = await repository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe("findById()", () => {
        it("should execute parameterized query and return player", async () => {
            const player = {
                id: 10,
                name: "Virat Kohli",
                country: "India",
                role: "Batter",
                teams: [
                    {
                        id: 1,
                        name: "India",
                        short_name: "IND"
                    }
                ]
            };

            databaseClient.query.mockResolvedValue({
                rows: [player]
            });

            const result = await repository.findById(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("WHERE p.id = $1"),
                    [10]
                );

            expect(result).toEqual(player);
        });

        it("should return null when player does not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result = await repository.findById(999);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.any(String),
                    [999]
                );

            expect(result).toBeNull();
        });
    });

    describe("findStatisticsByPlayerId()", () => {
        it("should return aggregated player statistics", async () => {
            const statistics = {
                player_id: 10,
                name: "Virat Kohli",
                total_runs: 12000,
                balls_faced: 13000,
                fours: 1000,
                sixes: 300,
                total_wickets: 5,
                runs_conceded: 150
            };

            databaseClient.query.mockResolvedValue({
                rows: [statistics]
            });

            const result =
                await repository.findStatisticsByPlayerId(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("WHERE p.id = $1"),
                    [10]
                );

            expect(result).toEqual(statistics);
        });

        it("should return null when player statistics do not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findStatisticsByPlayerId(999);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.any(String),
                    [999]
                );

            expect(result).toBeNull();
        });
    });

    describe("findRankingByPlayerId()", () => {
        it("should return rankings for player", async () => {
            const rankings = [
                {
                    id: 1,
                    format: "ODI",
                    category: "BATTING",
                    position: 2,
                    rating: 850
                },
                {
                    id: 2,
                    format: "TEST",
                    category: "BATTING",
                    position: 4,
                    rating: 790
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: rankings
            });

            const result =
                await repository.findRankingByPlayerId(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE player_id = $1"
                    ),
                    [10]
                );

            expect(result).toEqual(rankings);
        });

        it("should return empty array when player has no rankings", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findRankingByPlayerId(10);

            expect(result).toEqual([]);
        });
    });

    describe("findNewsByPlayerId()", () => {
        it("should return news associated with player", async () => {
            const news = [
                {
                    id: 1,
                    title: "Player reaches milestone",
                    content: "Milestone news"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: news
            });

            const result =
                await repository.findNewsByPlayerId(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE np.player_id = $1"
                    ),
                    [10]
                );

            expect(result).toEqual(news);
        });

        it("should return empty array when player has no news", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findNewsByPlayerId(10);

            expect(result).toEqual([]);
        });
    });

    describe("database failure", () => {
        it("should propagate database errors", async () => {
            databaseClient.query.mockRejectedValue(
                new Error("PostgreSQL query failed")
            );

            await expect(
                repository.findAll()
            ).rejects.toThrow("PostgreSQL query failed");
        });
    });
});
// Repository Pattern — isolates PostgreSQL-specific Player queries.
// SRP — repository handles Player data retrieval.
// Constructor DI — databaseClient is injected.
// DIP — application layer can depend on PlayerRepository.
// LSP — another implementation can replace PostgresPlayerRepository.
// Testability through DI — PostgreSQL is replaced by a deterministic mock during unit testing.
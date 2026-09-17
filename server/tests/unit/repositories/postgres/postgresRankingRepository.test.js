import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresRankingRepository
    from "../../../../src/repositories/postgres/postgresRankingRepository.js";

describe("PostgresRankingRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository = new PostgresRankingRepository(databaseClient);
    });

    describe("findAll()", () => {
        it("should execute query and return all rankings", async () => {
            const rankings = [
                {
                    id: 1,
                    player_id: 10,
                    team_id: null,
                    format: "ODI",
                    category: "BATTING",
                    position: 1,
                    rating: 900
                },
                {
                    id: 2,
                    player_id: null,
                    team_id: 20,
                    format: "TEST",
                    category: "TEAM",
                    position: 2,
                    rating: 850
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: rankings
            });

            const result = await repository.findAll();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("from rankings r")
                );

            expect(result).toEqual(rankings);
        });

        it("should return empty array when no rankings exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result = await repository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe("findById()", () => {
        it("should execute parameterized query and return ranking", async () => {
            const ranking = {
                id: 5,
                player_id: 10,
                team_id: null,
                format: "T20",
                category: "BATTING",
                position: 3,
                rating: 820
            };

            databaseClient.query.mockResolvedValue({
                rows: [ranking]
            });

            const result = await repository.findById(5);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("where r.id = $1"),
                    [5]
                );

            expect(result).toEqual(ranking);
        });

        it("should return null when ranking does not exist", async () => {
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

    describe("findPlayerRankings()", () => {
        it("should return player rankings", async () => {
            const rankings = [
                {
                    id: 1,
                    player_id: 10,
                    player_name: "Virat Kohli",
                    player_country: "India",
                    format: "ODI",
                    category: "BATTING",
                    position: 1,
                    rating: 900
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: rankings
            });

            const result =
                await repository.findPlayerRankings();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("join players p")
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "where r.player_id is not null"
                    )
                );

            expect(result).toEqual(rankings);
        });

        it("should return empty array when player rankings do not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findPlayerRankings();

            expect(result).toEqual([]);
        });
    });

    describe("findTeamRankings()", () => {
        it("should return team rankings", async () => {
            const rankings = [
                {
                    id: 2,
                    team_id: 20,
                    team_name: "India",
                    team_short_name: "IND",
                    team_country: "India",
                    format: "ODI",
                    category: "TEAM",
                    position: 1,
                    rating: 950
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: rankings
            });

            const result =
                await repository.findTeamRankings();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("join teams t")
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "where r.team_id is not null"
                    )
                );

            expect(result).toEqual(rankings);
        });

        it("should return empty array when team rankings do not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findTeamRankings();

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

// Repository Pattern — isolates ranking SQL from the application layer.
// SRP — handles Ranking persistence/read operations only.
// Constructor DI — databaseClient is injected.
// DIP — service can depend on RankingRepository.
// LSP — PostgreSQL implementation can be replaced by another implementation.
// Testability through DI — mocked DB client lets us unit-test repository behavior independently.
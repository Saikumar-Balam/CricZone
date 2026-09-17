import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresTeamRepository
    from "../../../../src/repositories/postgres/postgresTeamRepository.js";

describe("PostgresTeamRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository =
            new PostgresTeamRepository(databaseClient);
    });

    describe("findAll()", () => {
        it("should return all teams", async () => {
            const teams = [
                {
                    id: 1,
                    name: "India",
                    short_name: "IND",
                    country: "India"
                },
                {
                    id: 2,
                    name: "Australia",
                    short_name: "AUS",
                    country: "Australia"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: teams
            });

            const result = await repository.findAll();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("FROM teams")
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "ORDER BY name ASC"
                    )
                );

            expect(result).toEqual(teams);
        });

        it("should return empty array when no teams exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result = await repository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe("findById()", () => {
        it("should return team when it exists", async () => {
            const team = {
                id: 1,
                name: "India",
                short_name: "IND",
                country: "India"
            };

            databaseClient.query.mockResolvedValue({
                rows: [team]
            });

            const result =
                await repository.findById(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE id = $1"
                    ),
                    [1]
                );

            expect(result).toEqual(team);
        });

        it("should return null when team does not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findById(999);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.any(String),
                    [999]
                );

            expect(result).toBeNull();
        });
    });

    describe("findPlayersByTeamId()", () => {
        it("should return players belonging to team", async () => {
            const players = [
                {
                    id: 10,
                    name: "Player One",
                    country: "India",
                    role: "BATSMAN"
                },
                {
                    id: 20,
                    name: "Player Two",
                    country: "India",
                    role: "BOWLER"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: players
            });

            const result =
                await repository.findPlayersByTeamId(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "LEFT JOIN player_teams pt"
                    ),
                    [1]
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "pt.team_id = $1"
                    ),
                    [1]
                );

            expect(result).toEqual(players);
        });

        it("should return empty array when team has no players", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findPlayersByTeamId(999);

            expect(result).toEqual([]);
        });
    });

    describe("findMatchesByTeamId()", () => {
        it("should return matches involving team", async () => {
            const matches = [
                {
                    id: 100,
                    format: "T20",
                    status: "COMPLETED",
                    team1_id: 1,
                    team2_id: 2
                },
                {
                    id: 101,
                    format: "ODI",
                    status: "UPCOMING",
                    team1_id: 3,
                    team2_id: 1
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: matches
            });

            const result =
                await repository.findMatchesByTeamId(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "m.team1_id = $1"
                    ),
                    [1]
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "OR m.team2_id = $1"
                    ),
                    [1]
                );

            expect(result).toEqual(matches);
        });

        it("should return empty array when team has no matches", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findMatchesByTeamId(999);

            expect(result).toEqual([]);
        });
    });

    describe("findRankingByTeamId()", () => {
        it("should return rankings belonging to team", async () => {
            const rankings = [
                {
                    id: 1,
                    format: "TEST",
                    category: "TEAM",
                    position: 1,
                    rating: 125
                },
                {
                    id: 2,
                    format: "ODI",
                    category: "TEAM",
                    position: 2,
                    rating: 118
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: rankings
            });

            const result =
                await repository.findRankingByTeamId(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE team_id = $1"
                    ),
                    [1]
                );

            expect(result).toEqual(rankings);
        });

        it("should return empty array when team has no rankings", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findRankingByTeamId(999);

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
            ).rejects.toThrow(
                "PostgreSQL query failed"
            );
        });
    });
});

// Repository Pattern — isolates PostgreSQL Team queries.
// SRP — handles Team persistence/read operations.
// Constructor DI — databaseClient is injected.
// DIP — TeamService depends on TeamRepository.
// LSP — another Team repository implementation can replace this one.
// Testability through DI — PostgreSQL dependency is mocked.
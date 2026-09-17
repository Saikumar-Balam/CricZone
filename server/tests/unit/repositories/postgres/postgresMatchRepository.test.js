import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresMatchRepository
    from "../../../../src/repositories/postgres/postgresMatchRepository.js";

describe("PostgresMatchRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository = new PostgresMatchRepository(databaseClient);
    });

    describe("findAll()", () => {
        it("should execute query and return all match rows", async () => {
            const matches = [
                {
                    id: 1,
                    format: "T20",
                    status: "LIVE",
                    team1_id: 10,
                    team2_id: 20
                },
                {
                    id: 2,
                    format: "ODI",
                    status: "COMPLETED",
                    team1_id: 30,
                    team2_id: 40
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: matches
            });

            const result = await repository.findAll();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("FROM matches m")
                );

            expect(result).toEqual(matches);
        });

        it("should return empty array when no matches exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result = await repository.findAll();

            expect(result).toEqual([]);
        });

        it("should propagate database error from findAll", async () => {
            const databaseError =
                new Error("PostgreSQL connection failed");

            databaseClient.query
                .mockRejectedValue(databaseError);

            await expect(
                repository.findAll()
            ).rejects.toThrow("PostgreSQL connection failed");
        });
    });

    describe("findById()", () => {
        it("should execute parameterized query and return matching match", async () => {
            const match = {
                id: 10,
                format: "TEST",
                status: "LIVE",
                team1_id: 1,
                team2_id: 2
            };

            databaseClient.query.mockResolvedValue({
                rows: [match]
            });

            const result = await repository.findById(10);

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("WHERE m.id = $1"),
                    [10]
                );

            expect(result).toEqual(match);
        });

        it("should return null when match does not exist", async () => {
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

        it("should propagate database error from findById", async () => {
            const databaseError =
                new Error("Database query failed");

            databaseClient.query
                .mockRejectedValue(databaseError);

            await expect(
                repository.findById(10)
            ).rejects.toThrow("Database query failed");
        });
    });
});

// Repository Pattern — PostgreSQL access is encapsulated behind the repository.
// DIP — repository uses the injected database abstraction instead of creating a DB connection itself.
// DI — mocked databaseClient can replace the real PostgreSQL client.
// SRP — repository remains responsible only for Match persistence/retrieval.
// LSP — PostgresMatchRepository fulfills the MatchRepository contract.
// Testability through DI — database behavior can be isolated without PostgreSQL.

// Run:
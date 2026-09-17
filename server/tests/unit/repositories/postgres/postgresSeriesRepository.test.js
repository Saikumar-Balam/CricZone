import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresSeriesRepository
    from "../../../../src/repositories/postgres/postgresSeriesRepository.js";

describe("PostgresSeriesRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository =
            new PostgresSeriesRepository(databaseClient);
    });

    describe("findAll()", () => {
        it("should return all series", async () => {
            const series = [
                {
                    id: 1,
                    name: "IPL 2026",
                    format: "T20",
                    status: "ONGOING"
                },
                {
                    id: 2,
                    name: "Border-Gavaskar Trophy",
                    format: "TEST",
                    status: "UPCOMING"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: series
            });

            const result = await repository.findAll();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("FROM series")
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "ORDER BY start_date DESC"
                    )
                );

            expect(result).toEqual(series);
        });

        it("should return empty array when no series exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result = await repository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe("findById()", () => {
        it("should execute parameterized query and return series", async () => {
            const series = {
                id: 10,
                name: "Champions Trophy",
                format: "ODI",
                status: "COMPLETED"
            };

            databaseClient.query.mockResolvedValue({
                rows: [series]
            });

            const result =
                await repository.findById(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE id = $1"
                    ),
                    [10]
                );

            expect(result).toEqual(series);
        });

        it("should return null when series does not exist", async () => {
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

    describe("findMatchesBySeriesId()", () => {
        it("should return matches belonging to series", async () => {
            const matches = [
                {
                    id: 1,
                    format: "T20",
                    status: "COMPLETED",
                    team1_id: 10,
                    team2_id: 20
                },
                {
                    id: 2,
                    format: "T20",
                    status: "UPCOMING",
                    team1_id: 30,
                    team2_id: 40
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: matches
            });

            const result =
                await repository.findMatchesBySeriesId(5);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE m.series_id = $1"
                    ),
                    [5]
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "ORDER BY m.start_time ASC"
                    ),
                    [5]
                );

            expect(result).toEqual(matches);
        });

        it("should return empty array when series has no matches", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findMatchesBySeriesId(5);

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
// Repository Pattern — isolates Series PostgreSQL queries.
// SRP — handles Series data retrieval only.
// DI — databaseClient is constructor-injected.
// DIP — higher layers depend on SeriesRepository.
// LSP — another SeriesRepository implementation can substitute it.
// Testability through DI — database dependency is replaced with a mock.

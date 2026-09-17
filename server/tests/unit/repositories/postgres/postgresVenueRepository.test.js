import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresVenueRepository
    from "../../../../src/repositories/postgres/postgresVenueRepository.js";

describe("PostgresVenueRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository =
            new PostgresVenueRepository(databaseClient);
    });

    describe("findAll()", () => {
        it("should return all venues", async () => {
            const venues = [
                {
                    id: 1,
                    name: "Rajiv Gandhi International Stadium",
                    city: "Hyderabad",
                    country: "India"
                },
                {
                    id: 2,
                    name: "Wankhede Stadium",
                    city: "Mumbai",
                    country: "India"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: venues
            });

            const result = await repository.findAll();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "FROM venues"
                    )
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "ORDER BY name ASC"
                    )
                );

            expect(result).toEqual(venues);
        });

        it("should return empty array when no venues exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe("findById()", () => {
        it("should return venue when it exists", async () => {
            const venue = {
                id: 1,
                name: "Rajiv Gandhi International Stadium",
                city: "Hyderabad",
                country: "India"
            };

            databaseClient.query.mockResolvedValue({
                rows: [venue]
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

            expect(result).toEqual(venue);
        });

        it("should return null when venue does not exist", async () => {
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

    describe("findMatchesByVenueId()", () => {
        it("should return matches played at venue", async () => {
            const matches = [
                {
                    id: 100,
                    format: "T20",
                    status: "COMPLETED",
                    series_id: 10,
                    team1_id: 1,
                    team2_id: 2
                },
                {
                    id: 101,
                    format: "ODI",
                    status: "UPCOMING",
                    series_id: 20,
                    team1_id: 3,
                    team2_id: 4
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: matches
            });

            const result =
                await repository.findMatchesByVenueId(5);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE m.venue_id = $1"
                    ),
                    [5]
                );

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "ORDER BY m.start_time DESC"
                    ),
                    [5]
                );

            expect(result).toEqual(matches);
        });

        it("should return empty array when venue has no matches", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findMatchesByVenueId(999);

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

// Repository Pattern — PostgreSQL Venue queries are isolated.
// SRP — handles Venue persistence/read operations.
// Constructor DI — databaseClient is injected.
// DIP — VenueService depends on VenueRepository.
// LSP — another VenueRepository implementation can substitute it.
// Testability through DI — database access is mockable.
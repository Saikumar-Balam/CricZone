import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresNewsRepository
    from "../../../../src/repositories/postgres/postgresNewsRepository.js";

describe("PostgresNewsRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository = new PostgresNewsRepository(databaseClient);
    });

    describe("findAll()", () => {
        it("should execute query and return all news rows", async () => {
            const news = [
                {
                    id: 1,
                    title: "India wins",
                    content: "Match report",
                    image_url: "image-1.jpg"
                },
                {
                    id: 2,
                    title: "Series announced",
                    content: "Series report",
                    image_url: "image-2.jpg"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: news
            });

            const result = await repository.findAll();

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(1);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("FROM news n")
                );

            expect(result).toEqual(news);
        });

        it("should return empty array when no news exists", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result = await repository.findAll();

            expect(result).toEqual([]);
        });
    });

    describe("findById()", () => {
        it("should execute parameterized query and return news", async () => {
            const news = {
                id: 10,
                title: "Cricket News",
                content: "News content"
            };

            databaseClient.query.mockResolvedValue({
                rows: [news]
            });

            const result = await repository.findById(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining("WHERE n.id = $1"),
                    [10]
                );

            expect(result).toEqual(news);
        });

        it("should return null when news does not exist", async () => {
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

    describe("findByPlayerId()", () => {
        it("should return news associated with player", async () => {
            const news = [
                {
                    id: 1,
                    title: "Player News"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: news
            });

            const result = await repository.findByPlayerId(15);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE np.player_id = $1"
                    ),
                    [15]
                );

            expect(result).toEqual(news);
        });
    });

    describe("findByTeamId()", () => {
        it("should return news associated with team", async () => {
            const news = [
                {
                    id: 2,
                    title: "Team News"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: news
            });

            const result = await repository.findByTeamId(20);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE nt.team_id = $1"
                    ),
                    [20]
                );

            expect(result).toEqual(news);
        });
    });

    describe("findBySeriesId()", () => {
        it("should return news associated with series", async () => {
            const news = [
                {
                    id: 3,
                    title: "Series News"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: news
            });

            const result = await repository.findBySeriesId(30);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE ns.series_id = $1"
                    ),
                    [30]
                );

            expect(result).toEqual(news);
        });
    });

    describe("findByMatchId()", () => {
        it("should return news associated with match", async () => {
            const news = [
                {
                    id: 4,
                    title: "Match News"
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: news
            });

            const result = await repository.findByMatchId(40);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE nm.match_id = $1"
                    ),
                    [40]
                );

            expect(result).toEqual(news);
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

// Repository Pattern — encapsulates News PostgreSQL queries.
// SRP — handles News persistence/read operations only.
// DI — databaseClient is constructor-injected and easily mocked.
// DIP — higher layers depend on NewsRepository, not PostgreSQL details.
// LSP — this implementation can be replaced by another NewsRepository.
// Separation of Concerns — SQL remains isolated from services/controllers.
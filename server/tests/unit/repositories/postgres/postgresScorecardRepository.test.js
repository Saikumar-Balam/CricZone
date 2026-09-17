import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresScorecardRepository
    from "../../../../src/repositories/postgres/postgresScorecardRepository.js";

describe("PostgresScorecardRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn(),
            getClient: vi.fn()
        };

        repository =
            new PostgresScorecardRepository(databaseClient);
    });

    describe("findByMatchId()", () => {
        it("should return scorecard when it exists", async () => {
            const scorecard = {
                id: 1,
                match_id: 10
            };

            databaseClient.query.mockResolvedValue({
                rows: [scorecard]
            });

            const result =
                await repository.findByMatchId(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE sc.match_id = $1"
                    ),
                    [10]
                );

            expect(result).toEqual(scorecard);
        });

        it("should return null when scorecard does not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findByMatchId(999);

            expect(result).toBeNull();
        });
    });

    describe("findInningsByScorecardId()", () => {
        it("should return innings for scorecard", async () => {
            const innings = [
                {
                    id: 1,
                    scorecard_id: 10,
                    innings_number: 1
                },
                {
                    id: 2,
                    scorecard_id: 10,
                    innings_number: 2
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: innings
            });

            const result =
                await repository.findInningsByScorecardId(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE i.scorecard_id = $1"
                    ),
                    [10]
                );

            expect(result).toEqual(innings);
        });

        it("should return empty array when innings do not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findInningsByScorecardId(999);

            expect(result).toEqual([]);
        });
    });

    describe("findBattingPerformancesByInningsId()", () => {
        it("should return batting performances", async () => {
            const performances = [
                {
                    id: 1,
                    innings_id: 10,
                    player_id: 20,
                    runs: 75
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: performances
            });

            const result =
                await repository
                    .findBattingPerformancesByInningsId(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE bp.innings_id = $1"
                    ),
                    [10]
                );

            expect(result).toEqual(performances);
        });

        it("should return empty array when batting performances do not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository
                    .findBattingPerformancesByInningsId(999);

            expect(result).toEqual([]);
        });
    });

    describe("findBowlingPerformancesByInningsId()", () => {
        it("should return bowling performances", async () => {
            const performances = [
                {
                    id: 1,
                    innings_id: 10,
                    player_id: 30,
                    wickets: 3
                }
            ];

            databaseClient.query.mockResolvedValue({
                rows: performances
            });

            const result =
                await repository
                    .findBowlingPerformancesByInningsId(10);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE bwp.innings_id = $1"
                    ),
                    [10]
                );

            expect(result).toEqual(performances);
        });

        it("should return empty array when bowling performances do not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository
                    .findBowlingPerformancesByInningsId(999);

            expect(result).toEqual([]);
        });
    });

    describe("read query failure", () => {
        it("should propagate database errors", async () => {
            databaseClient.query.mockRejectedValue(
                new Error("PostgreSQL query failed")
            );

            await expect(
                repository.findByMatchId(10)
            ).rejects.toThrow("PostgreSQL query failed");
        });
    });
});
// Repository Pattern — PostgreSQL scorecard persistence is isolated here.
// SRP — repository owns scorecard persistence concerns.
// Constructor DI — databaseClient is injected.
// DIP — higher layers depend on ScorecardRepository.
// LSP — another implementation can replace this repository.
// Transaction Script — recordBall() coordinates one atomic scoring transaction.
// Atomicity — BEGIN → COMMIT, with ROLLBACK on failure.
// Testability through DI — DB/client behavior can be mocked.
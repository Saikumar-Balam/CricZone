import { beforeEach, describe, expect, it, vi } from "vitest";

import PostgresStatisticsRepository
    from "../../../../src/repositories/postgres/postgresStatisticsRepository.js";

describe("PostgresStatisticsRepository", () => {
    let databaseClient;
    let repository;

    beforeEach(() => {
        databaseClient = {
            query: vi.fn()
        };

        repository =
            new PostgresStatisticsRepository(databaseClient);
    });

    describe("formatOvers()", () => {
        it("should convert balls to cricket overs", () => {
            expect(repository.formatOvers(64)).toBe("10.4");
            expect(repository.formatOvers(60)).toBe("10.0");
            expect(repository.formatOvers(0)).toBe("0.0");
            expect(repository.formatOvers("13")).toBe("2.1");
        });
    });

    describe("findPlayerStatistics()", () => {
        it("should build format and competition statistics", async () => {
            databaseClient.query
                // batting by format
                .mockResolvedValueOnce({
                    rows: [
                        {
                            format: "T20",
                            innings_batted: "10",
                            dismissals: "8",
                            total_runs: "500",
                            balls_faced: "350",
                            fours: "40",
                            sixes: "20",
                            highest_score: "90",
                            strike_rate: "142.86",
                            batting_average: "62.50"
                        }
                    ]
                })

                // bowling by format
                .mockResolvedValueOnce({
                    rows: [
                        {
                            format: "T20",
                            innings_bowled: "5",
                            total_wickets: "8",
                            runs_conceded: "160",
                            maidens: "1",
                            balls_bowled: "120",
                            bowling_average: "20.00",
                            economy: "8.00"
                        }
                    ]
                })

                // best bowling by format
                .mockResolvedValueOnce({
                    rows: [
                        {
                            format: "T20",
                            best_wickets: "4",
                            best_runs_conceded: "25"
                        }
                    ]
                })

                // batting by competition
                .mockResolvedValueOnce({
                    rows: [
                        {
                            series_id: 100,
                            competition_name: "IPL",
                            format: "T20",
                            matches: "8",
                            innings_batted: "8",
                            dismissals: "6",
                            total_runs: "400",
                            balls_faced: "280",
                            fours: "30",
                            sixes: "18",
                            highest_score: "90",
                            strike_rate: "142.86",
                            batting_average: "66.67"
                        }
                    ]
                })

                // bowling by competition
                .mockResolvedValueOnce({
                    rows: [
                        {
                            series_id: 100,
                            competition_name: "IPL",
                            format: "T20",
                            matches: "5",
                            innings_bowled: "5",
                            total_wickets: "8",
                            runs_conceded: "160",
                            maidens: "1",
                            balls_bowled: "120",
                            bowling_average: "20.00",
                            economy: "8.00"
                        }
                    ]
                })

                // best bowling by competition
                .mockResolvedValueOnce({
                    rows: [
                        {
                            series_id: 100,
                            competition_name: "IPL",
                            format: "T20",
                            best_wickets: "4",
                            best_runs_conceded: "25"
                        }
                    ]
                });

            const result =
                await repository.findPlayerStatistics(10);

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(6);

            for (const call of databaseClient.query.mock.calls) {
                expect(call[1]).toEqual([10]);
            }

            expect(result).toEqual({
                formatStatistics: [
                    {
                        format: "T20",

                        batting: {
                            inningsBatted: 10,
                            dismissals: 8,
                            notOuts: 2,
                            totalRuns: 500,
                            ballsFaced: 350,
                            fours: 40,
                            sixes: 20,
                            highestScore: 90,
                            strikeRate: 142.86,
                            battingAverage: 62.5
                        },

                        bowling: {
                            inningsBowled: 5,
                            totalWickets: 8,
                            runsConceded: 160,
                            maidens: 1,
                            ballsBowled: 120,
                            oversBowled: "20.0",
                            bowlingAverage: 20,
                            economy: 8,

                            bestBowling: {
                                wickets: 4,
                                runsConceded: 25,
                                display: "4/25"
                            }
                        }
                    }
                ],

                competitionStatistics: [
                    {
                        seriesId: 100,
                        competitionName: "IPL",
                        format: "T20",

                        batting: {
                            matches: 8,
                            inningsBatted: 8,
                            dismissals: 6,
                            notOuts: 2,
                            totalRuns: 400,
                            ballsFaced: 280,
                            fours: 30,
                            sixes: 18,
                            highestScore: 90,
                            strikeRate: 142.86,
                            battingAverage: 66.67
                        },

                        bowling: {
                            matches: 5,
                            inningsBowled: 5,
                            totalWickets: 8,
                            runsConceded: 160,
                            maidens: 1,
                            ballsBowled: 120,
                            oversBowled: "20.0",
                            bowlingAverage: 20,
                            economy: 8,

                            bestBowling: {
                                wickets: 4,
                                runsConceded: 25,
                                display: "4/25"
                            }
                        }
                    }
                ]
            });
        });

        it("should handle bowling-only statistics and null averages", async () => {
            databaseClient.query
                .mockResolvedValueOnce({
                    rows: []
                })

                .mockResolvedValueOnce({
                    rows: [
                        {
                            format: "TEST",
                            innings_bowled: "2",
                            total_wickets: "0",
                            runs_conceded: "50",
                            maidens: "2",
                            balls_bowled: "64",
                            bowling_average: null,
                            economy: null
                        }
                    ]
                })

                .mockResolvedValueOnce({
                    rows: []
                })

                .mockResolvedValueOnce({
                    rows: []
                })

                .mockResolvedValueOnce({
                    rows: [
                        {
                            series_id: 200,
                            competition_name: "Test Series",
                            format: "TEST",
                            matches: "2",
                            innings_bowled: "2",
                            total_wickets: "0",
                            runs_conceded: "50",
                            maidens: "2",
                            balls_bowled: "64",
                            bowling_average: null,
                            economy: null
                        }
                    ]
                })

                .mockResolvedValueOnce({
                    rows: []
                });

            const result =
                await repository.findPlayerStatistics(20);

            expect(result.formatStatistics[0].batting)
                .toBeNull();

            expect(result.formatStatistics[0].bowling)
                .toMatchObject({
                    ballsBowled: 64,
                    oversBowled: "10.4",
                    bowlingAverage: null,
                    economy: null
                });

            expect(result.competitionStatistics[0].batting)
                .toBeNull();

            expect(
                result.competitionStatistics[0]
                    .bowling.oversBowled
            ).toBe("10.4");
        });

        it("should create statistics when only best bowling data exists", async () => {
            databaseClient.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            format: "ODI",
                            best_wickets: "5",
                            best_runs_conceded: "30"
                        }
                    ]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            series_id: 300,
                            competition_name: "World Cup",
                            format: "ODI",
                            best_wickets: "5",
                            best_runs_conceded: "30"
                        }
                    ]
                });

            const result =
                await repository.findPlayerStatistics(30);

            expect(result.formatStatistics[0]).toEqual({
                format: "ODI",
                batting: null,
                bowling: {
                    bestBowling: {
                        wickets: 5,
                        runsConceded: 30,
                        display: "5/30"
                    }
                }
            });

            expect(
                result.competitionStatistics[0].bowling.bestBowling
            ).toEqual({
                wickets: 5,
                runsConceded: 30,
                display: "5/30"
            });
        });

        it("should preserve null batting average", async () => {
            const batting = {
                format: "T20",
                innings_batted: "1",
                dismissals: "0",
                total_runs: "50",
                balls_faced: "30",
                fours: "4",
                sixes: "2",
                highest_score: "50",
                strike_rate: "166.67",
                batting_average: null
            };

            const competitionBatting = {
                series_id: 1,
                competition_name: "League",
                format: "T20",
                matches: "1",
                innings_batted: "1",
                dismissals: "0",
                total_runs: "50",
                balls_faced: "30",
                fours: "4",
                sixes: "2",
                highest_score: "50",
                strike_rate: "166.67",
                batting_average: null
            };

            databaseClient.query
                .mockResolvedValueOnce({ rows: [batting] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [competitionBatting]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const result =
                await repository.findPlayerStatistics(10);

            expect(
                result.formatStatistics[0]
                    .batting.battingAverage
            ).toBeNull();

            expect(
                result.competitionStatistics[0]
                    .batting.battingAverage
            ).toBeNull();
        });
    });

    describe("findTeamStatistics()", () => {
        it("should build team format and competition statistics", async () => {
            databaseClient.query
                .mockResolvedValueOnce({
                    rows: [
                        {
                            format: "T20",
                            matches_played: "10",
                            completed_matches: "8",
                            total_runs: "1800",
                            wickets_taken: "60"
                        }
                    ]
                })
                .mockResolvedValueOnce({
                    rows: [
                        {
                            series_id: 100,
                            competition_name: "IPL",
                            format: "T20",
                            matches_played: "5",
                            completed_matches: "4",
                            total_runs: "900",
                            wickets_taken: "30"
                        }
                    ]
                });

            const result =
                await repository.findTeamStatistics(5);

            expect(databaseClient.query)
                .toHaveBeenCalledTimes(2);

            expect(
                databaseClient.query.mock.calls[0][1]
            ).toEqual([5]);

            expect(
                databaseClient.query.mock.calls[1][1]
            ).toEqual([5]);

            expect(result).toEqual({
                formatStatistics: [
                    {
                        format: "T20",
                        matchesPlayed: 10,
                        completedMatches: 8,
                        totalRuns: 1800,
                        wicketsTaken: 60
                    }
                ],

                competitionStatistics: [
                    {
                        seriesId: 100,
                        competitionName: "IPL",
                        format: "T20",
                        matchesPlayed: 5,
                        completedMatches: 4,
                        totalRuns: 900,
                        wicketsTaken: 30
                    }
                ]
            });
        });

        it("should return empty statistics when team has no data", async () => {
            databaseClient.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const result =
                await repository.findTeamStatistics(999);

            expect(result).toEqual({
                formatStatistics: [],
                competitionStatistics: []
            });
        });
    });

    describe("findSeriesStatistics()", () => {
        it("should return transformed series statistics", async () => {
            databaseClient.query.mockResolvedValue({
                rows: [
                    {
                        series_id: 50,
                        series_name: "Champions Trophy",
                        total_matches: "15",
                        completed_matches: "12",
                        live_matches: "1",
                        total_runs: "7000",
                        total_wickets: "180"
                    }
                ]
            });

            const result =
                await repository.findSeriesStatistics(50);

            expect(databaseClient.query)
                .toHaveBeenCalledWith(
                    expect.stringContaining(
                        "WHERE s.id = $1"
                    ),
                    [50]
                );

            expect(result).toEqual({
                seriesId: 50,
                seriesName: "Champions Trophy",
                totalMatches: 15,
                completedMatches: 12,
                liveMatches: 1,
                totalRuns: 7000,
                totalWickets: 180
            });
        });

        it("should return null when series statistics do not exist", async () => {
            databaseClient.query.mockResolvedValue({
                rows: []
            });

            const result =
                await repository.findSeriesStatistics(999);

            expect(result).toBeNull();
        });
    });

    describe("database failure", () => {
        it("should propagate database errors", async () => {
            databaseClient.query.mockRejectedValue(
                new Error("PostgreSQL statistics query failed")
            );

            await expect(
                repository.findTeamStatistics(1)
            ).rejects.toThrow(
                "PostgreSQL statistics query failed"
            );
        });
    });
});

// Repository Pattern — aggregate statistics SQL stays in the persistence layer.
// SRP — repository builds derived Statistics read models.
// DI — databaseClient is injected.
// DIP — higher layers depend on StatisticsRepository.
// OCP — format handling uses data coming from match_formats.
// LSP — another StatisticsRepository implementation can substitute this one.
// Testability through DI — six-query player aggregation can be tested deterministically without PostgreSQL.
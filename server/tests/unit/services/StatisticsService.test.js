import { beforeEach, describe, expect, it, vi } from "vitest";

import StatisticsService from "../../../src/services/StatisticsService.js";
import PlayerNotFoundError from "../../../src/errors/PlayerNotFoundError.js";
import TeamNotFoundError from "../../../src/errors/TeamNotFoundError.js";
import SeriesNotFoundError from "../../../src/errors/SeriesNotFoundError.js";

describe("StatisticsService", () => {
    let statisticsRepository;
    let playerRepository;
    let teamRepository;
    let seriesRepository;
    let statisticsService;

    beforeEach(() => {
        statisticsRepository = {
            findPlayerStatistics: vi.fn(),
            findTeamStatistics: vi.fn(),
            findSeriesStatistics: vi.fn()
        };

        playerRepository = {
            findById: vi.fn()
        };

        teamRepository = {
            findById: vi.fn()
        };

        seriesRepository = {
            findById: vi.fn()
        };

        statisticsService = new StatisticsService(
            statisticsRepository,
            playerRepository,
            teamRepository,
            seriesRepository
        );

        vi.clearAllMocks();
    });

    describe("getPlayerStatistics()", () => {
        it("should return player statistics when player exists", async () => {
            const player = {
                id: 1,
                name: "Virat Kohli",
                country: "India",
                role: "Batsman",
                teams: ["India", "RCB"]
            };

            const statistics = {
                formatStatistics: [
                    {
                        format: "ODI",
                        matches: 300,
                        runs: 14000
                    }
                ],
                competitionStatistics: [
                    {
                        competition: "World Cup",
                        matches: 30
                    }
                ]
            };

            playerRepository.findById
                .mockResolvedValue(player);

            statisticsRepository.findPlayerStatistics
                .mockResolvedValue(statistics);

            const result =
                await statisticsService.getPlayerStatistics(1);

            expect(playerRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(
                statisticsRepository.findPlayerStatistics
            ).toHaveBeenCalledWith(1);

            expect(result).toEqual({
                player: {
                    id: 1,
                    name: "Virat Kohli",
                    country: "India",
                    role: "Batsman",
                    teams: ["India", "RCB"]
                },
                formatStatistics: statistics.formatStatistics,
                competitionStatistics:
                    statistics.competitionStatistics
            });
        });

        it("should use empty arrays when player statistics or teams are missing", async () => {
            const player = {
                id: 1,
                name: "Virat Kohli",
                country: "India",
                role: "Batsman"
            };

            playerRepository.findById
                .mockResolvedValue(player);

            statisticsRepository.findPlayerStatistics
                .mockResolvedValue({});

            const result =
                await statisticsService.getPlayerStatistics(1);

            expect(result).toEqual({
                player: {
                    id: 1,
                    name: "Virat Kohli",
                    country: "India",
                    role: "Batsman",
                    teams: []
                },
                formatStatistics: [],
                competitionStatistics: []
            });
        });

        it("should throw PlayerNotFoundError when player does not exist", async () => {
            playerRepository.findById
                .mockResolvedValue(null);

            await expect(
                statisticsService.getPlayerStatistics(999)
            ).rejects.toBeInstanceOf(PlayerNotFoundError);

            expect(
                statisticsRepository.findPlayerStatistics
            ).not.toHaveBeenCalled();
        });
    });

    describe("getTeamStatistics()", () => {
        it("should return team statistics when team exists", async () => {
            const team = {
                id: 10,
                name: "India",
                short_name: "IND",
                country: "India"
            };

            const statistics = {
                formatStatistics: [
                    {
                        format: "ODI",
                        matches: 100
                    }
                ],
                competitionStatistics: [
                    {
                        competition: "World Cup",
                        titles: 2
                    }
                ]
            };

            teamRepository.findById
                .mockResolvedValue(team);

            statisticsRepository.findTeamStatistics
                .mockResolvedValue(statistics);

            const result =
                await statisticsService.getTeamStatistics(10);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(10);

            expect(
                statisticsRepository.findTeamStatistics
            ).toHaveBeenCalledWith(10);

            expect(result).toEqual({
                team: {
                    id: 10,
                    name: "India",
                    shortName: "IND",
                    country: "India"
                },
                formatStatistics: statistics.formatStatistics,
                competitionStatistics:
                    statistics.competitionStatistics
            });
        });

        it("should use empty arrays when team statistics are missing", async () => {
            const team = {
                id: 10,
                name: "India",
                short_name: "IND",
                country: "India"
            };

            teamRepository.findById
                .mockResolvedValue(team);

            statisticsRepository.findTeamStatistics
                .mockResolvedValue({});

            const result =
                await statisticsService.getTeamStatistics(10);

            expect(result.formatStatistics).toEqual([]);
            expect(result.competitionStatistics).toEqual([]);
        });

        it("should throw TeamNotFoundError when team does not exist", async () => {
            teamRepository.findById
                .mockResolvedValue(null);

            await expect(
                statisticsService.getTeamStatistics(999)
            ).rejects.toBeInstanceOf(TeamNotFoundError);

            expect(
                statisticsRepository.findTeamStatistics
            ).not.toHaveBeenCalled();
        });
    });

    describe("getSeriesStatistics()", () => {
        it("should return series statistics when series exists", async () => {
            const series = {
                id: 20,
                name: "Border-Gavaskar Trophy",
                format: "TEST",
                status: "COMPLETED"
            };

            const statistics = {
                matches: 5,
                totalRuns: 4200
            };

            seriesRepository.findById
                .mockResolvedValue(series);

            statisticsRepository.findSeriesStatistics
                .mockResolvedValue(statistics);

            const result =
                await statisticsService.getSeriesStatistics(20);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(20);

            expect(
                statisticsRepository.findSeriesStatistics
            ).toHaveBeenCalledWith(20);

            expect(result).toEqual({
                series: {
                    id: 20,
                    name: "Border-Gavaskar Trophy",
                    format: "TEST",
                    status: "COMPLETED"
                },
                statistics
            });
        });

        it("should throw SeriesNotFoundError when series does not exist", async () => {
            seriesRepository.findById
                .mockResolvedValue(null);

            await expect(
                statisticsService.getSeriesStatistics(999)
            ).rejects.toBeInstanceOf(SeriesNotFoundError);

            expect(
                statisticsRepository.findSeriesStatistics
            ).not.toHaveBeenCalled();
        });
    });
});

// SRP — StatisticsService handles statistics use-case orchestration.
// DIP — service depends on repository abstractions.
// Dependency Injection — all four repositories are constructor-injected.
// LSP — mocks can replace concrete PostgreSQL repositories.
// OCP — persistence implementations can change without changing service logic.
// Service Layer Pattern — validation and aggregate-response construction belong here.
// Repository Pattern — DB access remains outside the service.
// Separation of Concerns — entity validation, persistence, and response orchestration remain separated.
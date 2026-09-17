import { beforeEach, describe, expect, it, vi } from "vitest";
import StatisticsController from "../../../src/controllers/StatisticsController.js";

describe("StatisticsController", () => {

    let statisticsService;
    let controller;
    let req;
    let res;
    let next;

    beforeEach(() => {

        statisticsService = {
            getPlayerStatistics: vi.fn(),
            getTeamStatistics: vi.fn(),
            getSeriesStatistics: vi.fn()
        };

        // Constructor Dependency Injection
        controller = new StatisticsController(statisticsService);

        req = {
            params: {}
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        next = vi.fn();
    });


    describe("getPlayerStatistics()", () => {

        it("should return player statistics", async () => {

            req.params.playerId = "10";

            const statistics = {
                playerId: 10,
                matches: 50,
                runs: 2500
            };

            statisticsService.getPlayerStatistics
                .mockResolvedValue(statistics);

            await controller.getPlayerStatistics(req, res, next);

            expect(statisticsService.getPlayerStatistics)
                .toHaveBeenCalledWith("10");

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: statistics
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.playerId = "999";

            const error = new Error("Player statistics failure");

            statisticsService.getPlayerStatistics
                .mockRejectedValue(error);

            await controller.getPlayerStatistics(req, res, next);

            expect(statisticsService.getPlayerStatistics)
                .toHaveBeenCalledWith("999");

            expect(next)
                .toHaveBeenCalledWith(error);

            expect(res.status)
                .not.toHaveBeenCalled();
        });

    });


    describe("getTeamStatistics()", () => {

        it("should return team statistics", async () => {

            req.params.teamId = "5";

            const statistics = {
                teamId: 5,
                matches: 100,
                wins: 65
            };

            statisticsService.getTeamStatistics
                .mockResolvedValue(statistics);

            await controller.getTeamStatistics(req, res, next);

            expect(statisticsService.getTeamStatistics)
                .toHaveBeenCalledWith("5");

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: statistics
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.teamId = "999";

            const error = new Error("Team statistics failure");

            statisticsService.getTeamStatistics
                .mockRejectedValue(error);

            await controller.getTeamStatistics(req, res, next);

            expect(statisticsService.getTeamStatistics)
                .toHaveBeenCalledWith("999");

            expect(next)
                .toHaveBeenCalledWith(error);

            expect(res.status)
                .not.toHaveBeenCalled();
        });

    });


    describe("getSeriesStatistics()", () => {

        it("should return series statistics", async () => {

            req.params.seriesId = "3";

            const statistics = {
                seriesId: 3,
                matches: 10,
                completedMatches: 8
            };

            statisticsService.getSeriesStatistics
                .mockResolvedValue(statistics);

            await controller.getSeriesStatistics(req, res, next);

            expect(statisticsService.getSeriesStatistics)
                .toHaveBeenCalledWith("3");

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: statistics
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.seriesId = "999";

            const error = new Error("Series statistics failure");

            statisticsService.getSeriesStatistics
                .mockRejectedValue(error);

            await controller.getSeriesStatistics(req, res, next);

            expect(statisticsService.getSeriesStatistics)
                .toHaveBeenCalledWith("999");

            expect(next)
                .toHaveBeenCalledWith(error);

            expect(res.status)
                .not.toHaveBeenCalled();
        });

    });

});

// SRP — Test file focuses only on StatisticsController behavior.
// Constructor DI — Mock statisticsService is injected through the controller constructor.
// DIP — Controller testing depends on the expected service abstraction/contract instead of a concrete database implementation.
// Separation of Concerns — Controller, service and repository responsibilities remain isolated.
// Testability — Dependencies and Express objects are mocked, allowing controller methods to be tested independently.
// Interface/Contract Testing — Verifies correct IDs are forwarded to the service and correct { success, data } HTTP responses are produced.
// Error Propagation — Verifies service errors are passed to next(error).
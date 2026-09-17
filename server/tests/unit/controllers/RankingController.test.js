import { beforeEach, describe, expect, it, vi } from "vitest";
import RankingController from "../../../src/controllers/RankingController.js";

describe("RankingController", () => {

    let rankingService;
    let controller;
    let req;
    let res;
    let next;

    beforeEach(() => {

        rankingService = {
            getRankings: vi.fn(),
            getRankingsById: vi.fn(),
            getPlayerRankings: vi.fn(),
            getTeamRankings: vi.fn()
        };

        // Constructor Dependency Injection
        controller = new RankingController(rankingService);

        req = {
            params: {}
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        next = vi.fn();
    });


    describe("getRankings()", () => {

        it("should return all rankings", async () => {

            const rankings = [
                { id: 1, rank: 1 },
                { id: 2, rank: 2 }
            ];

            rankingService.getRankings.mockResolvedValue(rankings);

            await controller.getRankings(req, res, next);

            expect(rankingService.getRankings)
                .toHaveBeenCalledOnce();

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: rankings
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            const error = new Error("Service failure");

            rankingService.getRankings.mockRejectedValue(error);

            await controller.getRankings(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getRankingsById()", () => {

        it("should return ranking by id", async () => {

            req.params.rankingId = "1";

            const ranking = {
                id: 1,
                rank: 1
            };

            rankingService.getRankingsById
                .mockResolvedValue(ranking);

            await controller.getRankingsById(req, res, next);

            expect(rankingService.getRankingsById)
                .toHaveBeenCalledWith("1");

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: ranking
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.rankingId = "999";

            const error = new Error("Ranking not found");

            rankingService.getRankingsById
                .mockRejectedValue(error);

            await controller.getRankingsById(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getPlayerRankings()", () => {

        it("should return player rankings", async () => {

            const rankings = [
                { playerId: 10, rank: 1 },
                { playerId: 20, rank: 2 }
            ];

            rankingService.getPlayerRankings
                .mockResolvedValue(rankings);

            await controller.getPlayerRankings(req, res, next);

            expect(rankingService.getPlayerRankings)
                .toHaveBeenCalledOnce();

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: rankings
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            const error = new Error("Service failure");

            rankingService.getPlayerRankings
                .mockRejectedValue(error);

            await controller.getPlayerRankings(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getTeamRankings()", () => {

        it("should return team rankings", async () => {

            const rankings = [
                { teamId: 1, rank: 1 },
                { teamId: 2, rank: 2 }
            ];

            rankingService.getTeamRankings
                .mockResolvedValue(rankings);

            await controller.getTeamRankings(req, res, next);

            expect(rankingService.getTeamRankings)
                .toHaveBeenCalledOnce();

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: rankings
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            const error = new Error("Service failure");

            rankingService.getTeamRankings
                .mockRejectedValue(error);

            await controller.getTeamRankings(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });

});

// SRP — This test suite is responsible only for verifying RankingController.
// Constructor Dependency Injection — Mock rankingService is injected into RankingController.
// DIP — Controller behavior is tested against the service contract/behavior without depending on the real service implementation.
// Separation of Concerns — No database/repository logic is involved in controller tests.
// Testability — rankingService, req, res, and next are isolated using mocks.
// Interface/Contract Testing — Verifies correct service method invocation, parameters, HTTP status and response structure.
// Error Propagation — Verifies service failures are delegated through next(error).
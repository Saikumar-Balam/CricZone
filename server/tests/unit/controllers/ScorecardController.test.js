import { beforeEach, describe, expect, it, vi } from "vitest";
import ScorecardController from "../../../src/controllers/ScorecardController.js";

describe("ScorecardController", () => {

    let scorecardService;
    let controller;
    let req;
    let res;
    let next;

    beforeEach(() => {

        scorecardService = {
            getScorecardByMatchId: vi.fn()
        };

        // Constructor Dependency Injection
        controller = new ScorecardController(scorecardService);

        req = {
            params: {}
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        next = vi.fn();
    });


    describe("getScorecardByMatchId()", () => {

        it("should return scorecard by match id", async () => {

            req.params.matchId = "10";

            const scorecard = {
                matchId: 10,
                innings: [
                    {
                        teamId: 1,
                        runs: 250,
                        wickets: 7
                    }
                ]
            };

            scorecardService.getScorecardByMatchId
                .mockResolvedValue(scorecard);

            await controller.getScorecardByMatchId(
                req,
                res,
                next
            );

            expect(scorecardService.getScorecardByMatchId)
                .toHaveBeenCalledWith("10");

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: scorecard
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.matchId = "999";

            const error = new Error("Scorecard not found");

            scorecardService.getScorecardByMatchId
                .mockRejectedValue(error);

            await controller.getScorecardByMatchId(
                req,
                res,
                next
            );

            expect(scorecardService.getScorecardByMatchId)
                .toHaveBeenCalledWith("999");

            expect(next)
                .toHaveBeenCalledWith(error);

            expect(res.status)
                .not.toHaveBeenCalled();

            expect(res.json)
                .not.toHaveBeenCalled();
        });

    });

});

// SRP — Tests only ScorecardController HTTP/controller behavior.
// Constructor DI — Mock scorecardService is injected into the controller.
// DIP — Controller test depends on the service contract rather than the real ScorecardService implementation.
// Separation of Concerns — Service, repository, PostgreSQL, and Redis behavior are not involved.
// Testability — Service and Express objects are mocked, allowing isolated controller testing.
// Interface/Contract Testing — Verifies matchId is passed correctly and the { success, data } response contract is maintained.
// Error Propagation — Service failures are forwarded to Express through next(error).
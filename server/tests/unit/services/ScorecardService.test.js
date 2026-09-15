import { beforeEach, describe, expect, it, vi } from "vitest";

import ScorecardService from "../../../src/services/ScorecardService.js";
import ScorecardNotFoundError from "../../../src/errors/ScorecardNotFoundError.js";

describe("ScorecardService", () => {
    let scorecardRepository;
    let scorecardService;

    beforeEach(() => {
        scorecardRepository = {
            findByMatchId: vi.fn(),
            findInningsByScorecardId: vi.fn(),
            findBattingPerformancesByInningsId: vi.fn(),
            findBowlingPerformancesByInningsId: vi.fn()
        };

        scorecardService = new ScorecardService(
            scorecardRepository
        );

        vi.clearAllMocks();
    });

    describe("getScorecardByMatchId()", () => {
        it("should return complete scorecard with innings and performances", async () => {
            const matchId = 10;

            const scorecard = {
                id: 100,
                match_id: matchId
            };

            const innings = [
                {
                    id: 1001,
                    scorecard_id: 100,
                    innings_number: 1
                },
                {
                    id: 1002,
                    scorecard_id: 100,
                    innings_number: 2
                }
            ];

            const battingInnings1 = [
                {
                    player_id: 1,
                    runs: 80
                }
            ];

            const bowlingInnings1 = [
                {
                    player_id: 5,
                    wickets: 3
                }
            ];

            const battingInnings2 = [
                {
                    player_id: 6,
                    runs: 65
                }
            ];

            const bowlingInnings2 = [
                {
                    player_id: 2,
                    wickets: 2
                }
            ];

            scorecardRepository.findByMatchId
                .mockResolvedValue(scorecard);

            scorecardRepository.findInningsByScorecardId
                .mockResolvedValue(innings);

            scorecardRepository.findBattingPerformancesByInningsId
                .mockImplementation(async (inningsId) => {
                    if (inningsId === 1001) {
                        return battingInnings1;
                    }

                    return battingInnings2;
                });

            scorecardRepository.findBowlingPerformancesByInningsId
                .mockImplementation(async (inningsId) => {
                    if (inningsId === 1001) {
                        return bowlingInnings1;
                    }

                    return bowlingInnings2;
                });

            const result =
                await scorecardService.getScorecardByMatchId(matchId);

            expect(scorecardRepository.findByMatchId)
                .toHaveBeenCalledWith(matchId);

            expect(scorecardRepository.findInningsByScorecardId)
                .toHaveBeenCalledWith(scorecard.id);

            expect(
                scorecardRepository.findBattingPerformancesByInningsId
            ).toHaveBeenCalledTimes(2);

            expect(
                scorecardRepository.findBowlingPerformancesByInningsId
            ).toHaveBeenCalledTimes(2);

            expect(result).toEqual({
                id: 100,
                matchId: 10,
                innings: [
                    {
                        ...innings[0],
                        batting_performances: battingInnings1,
                        bowling_performances: bowlingInnings1
                    },
                    {
                        ...innings[1],
                        batting_performances: battingInnings2,
                        bowling_performances: bowlingInnings2
                    }
                ]
            });
        });

        it("should throw ScorecardNotFoundError when scorecard does not exist", async () => {
            scorecardRepository.findByMatchId
                .mockResolvedValue(null);

            await expect(
                scorecardService.getScorecardByMatchId(999)
            ).rejects.toBeInstanceOf(ScorecardNotFoundError);

            expect(scorecardRepository.findByMatchId)
                .toHaveBeenCalledWith(999);

            expect(scorecardRepository.findInningsByScorecardId)
                .not.toHaveBeenCalled();

            expect(
                scorecardRepository.findBattingPerformancesByInningsId
            ).not.toHaveBeenCalled();

            expect(
                scorecardRepository.findBowlingPerformancesByInningsId
            ).not.toHaveBeenCalled();
        });

        it("should return scorecard with empty innings when no innings exist", async () => {
            const scorecard = {
                id: 100,
                match_id: 10
            };

            scorecardRepository.findByMatchId
                .mockResolvedValue(scorecard);

            scorecardRepository.findInningsByScorecardId
                .mockResolvedValue([]);

            const result =
                await scorecardService.getScorecardByMatchId(10);

            expect(result).toEqual({
                id: 100,
                matchId: 10,
                innings: []
            });

            expect(
                scorecardRepository.findBattingPerformancesByInningsId
            ).not.toHaveBeenCalled();

            expect(
                scorecardRepository.findBowlingPerformancesByInningsId
            ).not.toHaveBeenCalled();
        });

        it("should propagate scorecard repository failure", async () => {
            scorecardRepository.findByMatchId
                .mockRejectedValue(
                    new Error("Database failure")
                );

            await expect(
                scorecardService.getScorecardByMatchId(10)
            ).rejects.toThrow("Database failure");

            expect(scorecardRepository.findInningsByScorecardId)
                .not.toHaveBeenCalled();
        });

        it("should propagate innings repository failure", async () => {
            const scorecard = {
                id: 100,
                match_id: 10
            };

            scorecardRepository.findByMatchId
                .mockResolvedValue(scorecard);

            scorecardRepository.findInningsByScorecardId
                .mockRejectedValue(
                    new Error("Failed to load innings")
                );

            await expect(
                scorecardService.getScorecardByMatchId(10)
            ).rejects.toThrow("Failed to load innings");
        });

        it("should propagate batting performance repository failure", async () => {
            const scorecard = {
                id: 100,
                match_id: 10
            };

            const innings = [
                {
                    id: 1001,
                    scorecard_id: 100,
                    innings_number: 1
                }
            ];

            scorecardRepository.findByMatchId
                .mockResolvedValue(scorecard);

            scorecardRepository.findInningsByScorecardId
                .mockResolvedValue(innings);

            scorecardRepository.findBattingPerformancesByInningsId
                .mockRejectedValue(
                    new Error("Failed to load batting performances")
                );

            scorecardRepository.findBowlingPerformancesByInningsId
                .mockResolvedValue([]);

            await expect(
                scorecardService.getScorecardByMatchId(10)
            ).rejects.toThrow(
                "Failed to load batting performances"
            );
        });

        it("should propagate bowling performance repository failure", async () => {
            const scorecard = {
                id: 100,
                match_id: 10
            };

            const innings = [
                {
                    id: 1001,
                    scorecard_id: 100,
                    innings_number: 1
                }
            ];

            scorecardRepository.findByMatchId
                .mockResolvedValue(scorecard);

            scorecardRepository.findInningsByScorecardId
                .mockResolvedValue(innings);

            scorecardRepository.findBattingPerformancesByInningsId
                .mockResolvedValue([]);

            scorecardRepository.findBowlingPerformancesByInningsId
                .mockRejectedValue(
                    new Error("Failed to load bowling performances")
                );

            await expect(
                scorecardService.getScorecardByMatchId(10)
            ).rejects.toThrow(
                "Failed to load bowling performances"
            );
        });
    });
});

// SRP — service handles scorecard orchestration, not SQL or HTTP.
// DIP — depends on the scorecard repository abstraction.
// Dependency Injection — repository is constructor-injected.
// LSP — mock repository substitutes the PostgreSQL implementation.
// Service Layer Pattern — constructs the complete scorecard use-case response.
// Repository Pattern — persistence stays behind the repository.
// Separation of Concerns — service assembles data; repository retrieves data.
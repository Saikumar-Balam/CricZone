import { beforeEach, describe, expect, it, vi } from "vitest";

import TeamService from "../../../src/services/TeamService.js";
import TeamNotFoundError from "../../../src/errors/TeamNotFoundError.js";

describe("TeamService", () => {
    let teamRepository;
    let teamService;

    beforeEach(() => {
        teamRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findPlayersByTeamId: vi.fn(),
            findMatchesByTeamId: vi.fn(),
            findRankingByTeamId: vi.fn()
        };

        teamService = new TeamService(teamRepository);

        vi.clearAllMocks();
    });

    describe("getTeams()", () => {
        it("should return all teams", async () => {
            const teams = [
                {
                    id: 1,
                    name: "India",
                    short_name: "IND"
                },
                {
                    id: 2,
                    name: "Australia",
                    short_name: "AUS"
                }
            ];

            teamRepository.findAll.mockResolvedValue(teams);

            const result = await teamService.getTeams();

            expect(teamRepository.findAll)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(teams);
        });
    });

    describe("getTeamById()", () => {
        it("should return team when team exists", async () => {
            const team = {
                id: 1,
                name: "India",
                short_name: "IND"
            };

            teamRepository.findById.mockResolvedValue(team);

            const result =
                await teamService.getTeamById(1);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(team);
        });

        it("should throw TeamNotFoundError when team does not exist", async () => {
            teamRepository.findById.mockResolvedValue(null);

            await expect(
                teamService.getTeamById(999)
            ).rejects.toBeInstanceOf(TeamNotFoundError);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(999);
        });
    });

    describe("getPlayersByTeamId()", () => {
        it("should return players when team exists", async () => {
            const team = {
                id: 1,
                name: "India"
            };

            const players = [
                {
                    id: 10,
                    name: "Virat Kohli"
                },
                {
                    id: 11,
                    name: "Rohit Sharma"
                }
            ];

            teamRepository.findById
                .mockResolvedValue(team);

            teamRepository.findPlayersByTeamId
                .mockResolvedValue(players);

            const result =
                await teamService.getPlayersByTeamId(1);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(teamRepository.findPlayersByTeamId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(players);
        });

        it("should throw TeamNotFoundError and not query players when team does not exist", async () => {
            teamRepository.findById.mockResolvedValue(null);

            await expect(
                teamService.getPlayersByTeamId(999)
            ).rejects.toBeInstanceOf(TeamNotFoundError);

            expect(teamRepository.findPlayersByTeamId)
                .not.toHaveBeenCalled();
        });
    });

    describe("getMatchesByTeamId()", () => {
        it("should return matches when team exists", async () => {
            const team = {
                id: 1,
                name: "India"
            };

            const matches = [
                {
                    id: 100,
                    team1_id: 1,
                    team2_id: 2
                }
            ];

            teamRepository.findById
                .mockResolvedValue(team);

            teamRepository.findMatchesByTeamId
                .mockResolvedValue(matches);

            const result =
                await teamService.getMatchesByTeamId(1);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(teamRepository.findMatchesByTeamId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(matches);
        });

        it("should throw TeamNotFoundError and not query matches when team does not exist", async () => {
            teamRepository.findById.mockResolvedValue(null);

            await expect(
                teamService.getMatchesByTeamId(999)
            ).rejects.toBeInstanceOf(TeamNotFoundError);

            expect(teamRepository.findMatchesByTeamId)
                .not.toHaveBeenCalled();
        });
    });

    describe("getRankingByTeamId()", () => {
        it("should return ranking when team exists", async () => {
            const team = {
                id: 1,
                name: "India"
            };

            const ranking = {
                team_id: 1,
                format: "TEST",
                rank: 1
            };

            teamRepository.findById
                .mockResolvedValue(team);

            teamRepository.findRankingByTeamId
                .mockResolvedValue(ranking);

            const result =
                await teamService.getRankingByTeamId(1);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(teamRepository.findRankingByTeamId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(ranking);
        });

        it("should throw TeamNotFoundError and not query ranking when team does not exist", async () => {
            teamRepository.findById.mockResolvedValue(null);

            await expect(
                teamService.getRankingByTeamId(999)
            ).rejects.toBeInstanceOf(TeamNotFoundError);

            expect(teamRepository.findRankingByTeamId)
                .not.toHaveBeenCalled();
        });
    });

    describe("ensureTeamExists()", () => {
        it("should return team when team exists", async () => {
            const team = {
                id: 1,
                name: "India"
            };

            teamRepository.findById.mockResolvedValue(team);

            const result =
                await teamService.ensureTeamExists(1);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(team);
        });

        it("should throw TeamNotFoundError when team does not exist", async () => {
            teamRepository.findById.mockResolvedValue(null);

            await expect(
                teamService.ensureTeamExists(999)
            ).rejects.toBeInstanceOf(TeamNotFoundError);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(999);
        });
    });
});

// SRP — Team use-case orchestration only.
// DIP — depends on repository abstraction rather than PostgreSQL directly.
// Dependency Injection — teamRepository is constructor-injected.
// LSP — mock repository substitutes the concrete repository during testing.
// OCP — repository implementation can change without modifying TeamService.
// Service Layer Pattern — business validation/orchestration stays in the service.
// Repository Pattern — persistence stays behind teamRepository.
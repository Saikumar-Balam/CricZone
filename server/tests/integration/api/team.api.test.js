import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"

import { createTeamRouter }
    from "../../../src/routes/team.route.js"

import TeamController
    from "../../../src/controllers/TeamController.js"


describe("Team API Integration", () => {

    function createTeamApp({
        teams = [],
        team = null,
        players = [],
        matches = [],
        ranking = []
    } = {}) {

        // Mock TeamService
        const teamService = {

            getTeams:
                vi.fn().mockResolvedValue(teams),

            getTeamById:
                vi.fn().mockResolvedValue(team),

            getPlayersByTeamId:
                vi.fn().mockResolvedValue(players),

            getMatchesByTeamId:
                vi.fn().mockResolvedValue(matches),

            getRankingByTeamId:
                vi.fn().mockResolvedValue(ranking)
        }


        // Real Controller
        const teamController =
            new TeamController(teamService)


        // Pass-through validation middleware.
        // Validation behavior will be tested separately in 17.12.
        const teamIdValidationMiddleware = {

            handle:
                vi.fn((req, res, next) => next())
        }


        // Real Team Router
        const teamRouter =
            createTeamRouter(
                teamController,
                teamIdValidationMiddleware
            )


        // Minimal Express application
        const app = express()

        app.use(
            "/api/v1/teams",
            teamRouter
        )


        return {
            app,
            teamService,
            teamIdValidationMiddleware
        }
    }


    it("should return all teams", async () => {

        const teams = [
            {
                id: 1,
                name: "India",
                short_name: "IND",
                country: "India",
                logo_url: "india.png"
            },
            {
                id: 2,
                name: "Australia",
                short_name: "AUS",
                country: "Australia",
                logo_url: "australia.png"
            }
        ]


        const {
            app,
            teamService
        } = createTeamApp({
            teams
        })


        const response =
            await request(app)
                .get("/api/v1/teams")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: teams
            })


        expect(teamService.getTeams)
            .toHaveBeenCalledOnce()
    })

    it("should return a team by id", async () => {

        const team = {
            id: 1,
            name: "India",
            short_name: "IND",
            country: "India",
            logo_url: "india.png"
        }


        const {
            app,
            teamService,
            teamIdValidationMiddleware
        } = createTeamApp({
            team
        })


        const response =
            await request(app)
                .get("/api/v1/teams/1")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: team
            })


        expect(
            teamIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            teamService.getTeamById
        ).toHaveBeenCalledWith("1")
    })


    it("should return players for a team", async () => {

        const players = [
            {
                id: 101,
                name: "Player One",
                country: "India",
                role: "BATSMAN",
                batting_style: "RIGHT_HANDED",
                bowling_style: null,
                image_url: "player-one.png"
            },
            {
                id: 102,
                name: "Player Two",
                country: "India",
                role: "BOWLER",
                batting_style: "RIGHT_HANDED",
                bowling_style: "RIGHT_ARM_FAST",
                image_url: "player-two.png"
            }
        ]


        const {
            app,
            teamService,
            teamIdValidationMiddleware
        } = createTeamApp({
            players
        })


        const response =
            await request(app)
                .get("/api/v1/teams/1/players")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: players
            })


        expect(
            teamIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            teamService.getPlayersByTeamId
        ).toHaveBeenCalledWith("1")
    })


    it("should return matches for a team", async () => {

        const matches = [
            {
                id: 1001,
                format: "T20",
                status: "LIVE",
                series_id: 10,
                series_name: "T20 Series",
                team1_id: 1,
                team1_name: "India",
                team1_short_name: "IND",
                team2_id: 2,
                team2_name: "Australia",
                team2_short_name: "AUS"
            },
            {
                id: 1002,
                format: "ODI",
                status: "SCHEDULED",
                series_id: 11,
                series_name: "ODI Series",
                team1_id: 1,
                team1_name: "India",
                team1_short_name: "IND",
                team2_id: 3,
                team2_name: "England",
                team2_short_name: "ENG"
            }
        ]


        const {
            app,
            teamService,
            teamIdValidationMiddleware
        } = createTeamApp({
            matches
        })


        const response =
            await request(app)
                .get("/api/v1/teams/1/matches")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: matches
            })


        expect(
            teamIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            teamService.getMatchesByTeamId
        ).toHaveBeenCalledWith("1")
    })


    it("should return ranking for a team", async () => {

        const ranking = [
            {
                id: 1,
                format: "T20",
                category: "TEAM",
                position: 1,
                rating: 275,
                updated_at: "2026-09-15T00:00:00.000Z"
            },
            {
                id: 2,
                format: "ODI",
                category: "TEAM",
                position: 2,
                rating: 260,
                updated_at: "2026-09-15T00:00:00.000Z"
            }
        ]

        const {
            app,
            teamService,
            teamIdValidationMiddleware
        } = createTeamApp({
            ranking
        })
        const response =
            await request(app)
                .get("/api/v1/teams/1/ranking")

        expect(response.status)
            .toBe(200)
        expect(response.body)
            .toEqual({
                success: true,
                data: ranking
            })
        expect(
            teamIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            teamService.getRankingByTeamId
        ).toHaveBeenCalledWith("1")
    })

})


// SRP — API tests verify Team HTTP behavior only.

// Dependency Injection — TeamService and validation middleware
// are supplied externally.

// DIP — TeamController does not depend directly on
// PostgresTeamRepository.

// Repository Pattern — PostgreSQL implementation remains
// behind the TeamRepository abstraction.

// Service Layer Pattern — Team use cases remain in TeamService.

// Separation of Concerns — HTTP, validation, business logic,
// and persistence remain separated.

// Test Doubles — TeamService is replaced with controlled mocks
// so API behavior can be tested independently.
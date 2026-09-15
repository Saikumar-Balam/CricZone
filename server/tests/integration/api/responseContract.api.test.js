import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"

import { createMatchRouter }
    from "../../../src/routes/match.routes.js"

import { createSeriesRouter }
    from "../../../src/routes/series.routes.js"

import { createTeamRouter }
    from "../../../src/routes/team.route.js"

import { createPlayerRouter }
    from "../../../src/routes/player.route.js"

import MatchController
    from "../../../src/controllers/MatchController.js"

import SeriesController
    from "../../../src/controllers/SeriesController.js"

import TeamController
    from "../../../src/controllers/TeamController.js"

import PlayerController
    from "../../../src/controllers/PlayerController.js"


describe("API Response Contract Integration", () => {

    function createValidationMiddleware() {
        return {
            handle: vi.fn((req, res, next) => next())
        }
    }


    function expectSuccessContract(response) {

        expect(response.status)
            .toBe(200)

        expect(response.headers["content-type"])
            .toMatch(/application\/json/)

        expect(response.body)
            .toHaveProperty("success", true)

        expect(response.body)
            .toHaveProperty("data")

        expect(Object.keys(response.body).sort())
            .toEqual(
                ["success", "data"].sort()
            )
    }


    function createApp() {
        const matchService = {

            getMatches:
                vi.fn().mockResolvedValue([
                    {
                        id: 1001,
                        format: "T20",
                        status: "LIVE"
                    }
                ]),

            getMatchById:
                vi.fn().mockResolvedValue({
                    id: 1001,
                    format: "T20",
                    status: "LIVE"
                })
        }

        const matchController =
            new MatchController(matchService)

        const matchValidation =
            createValidationMiddleware()

        const scorecardController = {
            getScorecardByMatchId: vi.fn()
        }


        const seriesService = {

            getSeries:
                vi.fn().mockResolvedValue([
                    {
                        id: 10,
                        name: "CricZone Series",
                        format: "T20"
                    }
                ]),

            getSeriesById:
                vi.fn().mockResolvedValue({
                    id: 10,
                    name: "CricZone Series",
                    format: "T20"
                }),

            getMatchesBySeriesId:
                vi.fn().mockResolvedValue([])
        }

        const seriesController =
            new SeriesController(seriesService)

        const seriesValidation =
            createValidationMiddleware()


        const teamService = {

            getTeams:
                vi.fn().mockResolvedValue([
                    {
                        id: 1,
                        name: "India",
                        short_name: "IND"
                    }
                ]),

            getTeamById:
                vi.fn().mockResolvedValue({
                    id: 1,
                    name: "India",
                    short_name: "IND"
                }),

            getPlayersByTeamId:
                vi.fn().mockResolvedValue([]),

            getMatchesByTeamId:
                vi.fn().mockResolvedValue([]),

            getRankingByTeamId:
                vi.fn().mockResolvedValue([])
        }

        const teamController =
            new TeamController(teamService)

        const teamValidation =
            createValidationMiddleware()

        const playerService = {

            getPlayers:
                vi.fn().mockResolvedValue([
                    {
                        id: 101,
                        name: "Player One"
                    }
                ]),

            getPlayersById:
                vi.fn().mockResolvedValue({
                    id: 101,
                    name: "Player One"
                }),

            getStatisticsByPlayerId:
                vi.fn().mockResolvedValue({}),

            getRankingByPlayerId:
                vi.fn().mockResolvedValue([]),

            getNewsByPlayerId:
                vi.fn().mockResolvedValue([])
        }

        const playerController =
            new PlayerController(playerService)

        const playerValidation =
            createValidationMiddleware()

        const matchRouter =
            createMatchRouter(
                matchController,
                matchValidation,
                scorecardController
            )

        const seriesRouter =
            createSeriesRouter(
                seriesController,
                seriesValidation
            )

        const teamRouter =
            createTeamRouter(
                teamController,
                teamValidation
            )

        const playerRouter =
            createPlayerRouter(
                playerController,
                playerValidation
            )

        const app = express()

        app.use(
            "/api/v1/matches",
            matchRouter
        )

        app.use(
            "/api/v1/series",
            seriesRouter
        )

        app.use(
            "/api/v1/teams",
            teamRouter
        )

        app.use(
            "/api/v1/players",
            playerRouter
        )

        return app
    }

    it("should follow common contract for Match API", async () => {

        const app = createApp()

        const response =
            await request(app)
                .get("/api/v1/matches")

        expectSuccessContract(response)

        expect(Array.isArray(response.body.data))
            .toBe(true)
    })

    it("should follow common contract for Series API", async () => {

        const app = createApp()

        const response =
            await request(app)
                .get("/api/v1/series")

        expectSuccessContract(response)

        expect(Array.isArray(response.body.data))
            .toBe(true)
    })

    it("should follow common contract for Team API", async () => {

        const app = createApp()

        const response =
            await request(app)
                .get("/api/v1/teams")

        expectSuccessContract(response)

        expect(Array.isArray(response.body.data))
            .toBe(true)
    })

    it("should follow common contract for Player API", async () => {

        const app = createApp()

        const response =
            await request(app)
                .get("/api/v1/players")

        expectSuccessContract(response)

        expect(Array.isArray(response.body.data))
            .toBe(true)
    })

    it("should follow common contract for single-resource responses", async () => {

        const app = createApp()

        const endpoints = [
            "/api/v1/matches/1001",
            "/api/v1/series/10",
            "/api/v1/teams/1",
            "/api/v1/players/101"
        ]


        for (const endpoint of endpoints) {

            const response =
                await request(app)
                    .get(endpoint)

            expectSuccessContract(response)

            expect(response.body.data)
                .not.toBeNull()

            expect(Array.isArray(response.body.data))
                .toBe(false)
        }
    })

})

// SRP — contract helper validates only common API response structure.

// DRY — expectSuccessContract() prevents repeated contract assertions.

// DI — controllers receive mocked services externally.

// DIP — API contract tests do not depend on PostgreSQL.

// Factory Pattern — router factories receive their dependencies.

// Separation of Concerns — response contract validation is
// separated from persistence and business-logic testing.
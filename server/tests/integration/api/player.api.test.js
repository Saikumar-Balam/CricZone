import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"

import { createPlayerRouter }
    from "../../../src/routes/player.route.js"

import PlayerController
    from "../../../src/controllers/PlayerController.js"


describe("Player API Integration", () => {

    function createPlayerApp({
        players = [],
        player = null,
        statistics = null,
        rankings = [],
        news = []
    } = {}) {

        // Mock PlayerService
        const playerService = {

            getPlayers:
                vi.fn().mockResolvedValue(players),

            getPlayersById:
                vi.fn().mockResolvedValue(player),

            getStatisticsByPlayerId:
                vi.fn().mockResolvedValue(statistics),

            getRankingByPlayerId:
                vi.fn().mockResolvedValue(rankings),

            getNewsByPlayerId:
                vi.fn().mockResolvedValue(news)
        }


        // Real controller
        const playerController =
            new PlayerController(playerService)


        // Pass-through validation middleware.
        // Validation itself is tested separately in 17.12.
        const playerIdValidationMiddleware = {

            handle:
                vi.fn((req, res, next) => next())
        }


        // Real router
        const playerRouter =
            createPlayerRouter(
                playerController,
                playerIdValidationMiddleware
            )


        // Minimal Express application
        const app = express()

        app.use(
            "/api/v1/players",
            playerRouter
        )


        return {
            app,
            playerService,
            playerIdValidationMiddleware
        }
    }

    it("should return all players", async () => {

        const players = [
            {
                id: 101,
                name: "Player One",
                country: "India",
                role: "BATSMAN",
                batting_style: "RIGHT_HANDED",
                bowling_style: null,
                image_url: "player-one.png",
                teams: [
                    {
                        id: 1,
                        name: "India",
                        short_name: "IND"
                    }
                ]
            },
            {
                id: 102,
                name: "Player Two",
                country: "Australia",
                role: "BOWLER",
                batting_style: "RIGHT_HANDED",
                bowling_style: "RIGHT_ARM_FAST",
                image_url: "player-two.png",
                teams: [
                    {
                        id: 2,
                        name: "Australia",
                        short_name: "AUS"
                    }
                ]
            }
        ]


        const {
            app,
            playerService
        } = createPlayerApp({
            players
        })


        const response =
            await request(app)
                .get("/api/v1/players")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: players
            })


        expect(playerService.getPlayers)
            .toHaveBeenCalledOnce()
    })


    it("should return a player by id", async () => {

        const player = {
            id: 101,
            name: "Player One",
            country: "India",
            role: "BATSMAN",
            batting_style: "RIGHT_HANDED",
            bowling_style: null,
            image_url: "player-one.png",
            teams: [
                {
                    id: 1,
                    name: "India",
                    short_name: "IND"
                }
            ]
        }


        const {
            app,
            playerService,
            playerIdValidationMiddleware
        } = createPlayerApp({
            player
        })


        const response =
            await request(app)
                .get("/api/v1/players/101")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: player
            })


        expect(
            playerIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            playerService.getPlayersById
        ).toHaveBeenCalledWith("101")
    })

    it("should return statistics for a player", async () => {
        const statistics = {
            player_id: 101,
            name: "Player One",
            total_runs: 2500,
            balls_faced: 1800,
            fours: 220,
            sixes: 85,
            total_wickets: 15,
            runs_conceded: 420
        }


        const {
            app,
            playerService,
            playerIdValidationMiddleware
        } = createPlayerApp({
            statistics
        })


        const response =
            await request(app)
                .get(
                    "/api/v1/players/101/statistics"
                )


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: statistics
            })


        expect(
            playerIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            playerService.getStatisticsByPlayerId
        ).toHaveBeenCalledWith("101")
    })

    it("should return rankings for a player", async () => {
        const rankings = [
            {
                id: 1,
                format: "T20",
                category: "BATTING",
                position: 3,
                rating: 820
            },
            {
                id: 2,
                format: "ODI",
                category: "BATTING",
                position: 5,
                rating: 790
            }
        ]


        const {
            app,
            playerService,
            playerIdValidationMiddleware
        } = createPlayerApp({
            rankings
        })


        const response =
            await request(app)
                .get(
                    "/api/v1/players/101/ranking"
                )


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: rankings
            })


        expect(
            playerIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            playerService.getRankingByPlayerId
        ).toHaveBeenCalledWith("101")
    })

    it("should return news for a player", async () => {
        const news = [
            {
                id: 501,
                title: "Player One scores century",
                content: "Match report",
                image_url: "news-501.png",
                published_at:
                    "2026-09-15T10:00:00.000Z"
            },
            {
                id: 502,
                title: "Player One reaches milestone",
                content: "Player milestone report",
                image_url: "news-502.png",
                published_at:
                    "2026-09-14T10:00:00.000Z"
            }
        ]


        const {
            app,
            playerService,
            playerIdValidationMiddleware
        } = createPlayerApp({
            news
        })


        const response =
            await request(app)
                .get(
                    "/api/v1/players/101/news"
                )


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: news
            })


        expect(
            playerIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            playerService.getNewsByPlayerId
        ).toHaveBeenCalledWith("101")
    })

})


// SRP — Player API tests verify Player HTTP behavior only.

// Dependency Injection — PlayerService and validation middleware
// are supplied externally.

// DIP — PlayerController does not depend directly on
// PostgresPlayerRepository.

// Repository Pattern — PostgreSQL queries remain behind
// PlayerRepository.

// Service Layer Pattern — Player use cases remain inside
// PlayerService.

// Separation of Concerns — HTTP, validation, business logic,
// and persistence remain separated.

// Test Doubles — PlayerService is replaced by controlled mocks
// for API-level testing.
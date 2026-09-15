import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"

import { createMatchRouter } from
    "../../../src/routes/match.routes.js"

import MatchController from
    "../../../src/controllers/MatchController.js"

describe("Match API Integration", () => {

    function createMatchApp({
        matches = [],
        match = null
    } = {}) {

        const matchService = {
            getMatches: vi.fn()
                .mockResolvedValue(matches),

            getMatchById: vi.fn()
                .mockResolvedValue(match)
        }

        const matchController =
            new MatchController(matchService)

        /*
         * Pass-through validation middleware.
         *
         * Validation middleware itself is tested
         * separately in 17.12.
         */
        const matchIdValidationMiddleware = {
            handle: vi.fn((req, res, next) => next())
        }

        /*
         * Scorecard isn't part of these Match tests.
         * We only provide the dependency required
         * by createMatchRouter().
         */
        const scorecardController = {
            getScorecardByMatchId: vi.fn()
        }

        const matchRouter =
            createMatchRouter(
                matchController,
                matchIdValidationMiddleware,
                scorecardController
            )

        const app = express()

        app.use(
            "/api/v1/matches",
            matchRouter
        )

        return {
            app,
            matchService,
            matchIdValidationMiddleware
        }
    }


    it("should return all matches", async () => {

        const matches = [
            {
                id: 1001,
                format: "T20",
                status: "LIVE",
                series_id: 10,
                series_name: "CricZone Series",
                team1_id: 1,
                team1_name: "India",
                team2_id: 2,
                team2_name: "Australia"
            },
            {
                id: 1002,
                format: "ODI",
                status: "SCHEDULED",
                series_id: 11,
                series_name: "ODI Series",
                team1_id: 3,
                team1_name: "England",
                team2_id: 4,
                team2_name: "South Africa"
            }
        ]

        const {
            app,
            matchService
        } = createMatchApp({
            matches
        })

        const response =
            await request(app)
                .get("/api/v1/matches")

        expect(response.status)
            .toBe(200)

        expect(response.body)
            .toEqual({
                success: true,
                data: matches
            })

        expect(matchService.getMatches)
            .toHaveBeenCalledOnce()
    })


    it("should return a match by id", async () => {

        const match = {
            id: 1001,
            format: "T20",
            status: "LIVE",
            series_id: 10,
            series_name: "CricZone Series",
            venue_id: 20,
            venue_name: "Test Stadium",
            team1_id: 1,
            team1_name: "India",
            team2_id: 2,
            team2_name: "Australia"
        }

        const {
            app,
            matchService,
            matchIdValidationMiddleware
        } = createMatchApp({
            match
        })

        const response =
            await request(app)
                .get("/api/v1/matches/1001")

        expect(response.status)
            .toBe(200)

        expect(response.body)
            .toEqual({
                success: true,
                data: match
            })

        expect(
            matchIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()

        expect(
            matchService.getMatchById
        ).toHaveBeenCalledWith("1001")
    })

})

// SRP — Match controller tests focus on Match HTTP behavior.
// DI — Service, validation middleware and scorecard controller are injected.
// DIP — Controller doesn't depend on PostgreSQL.
// Factory Pattern — createMatchRouter() constructs the router from supplied dependencies.
// Service Layer Pattern — Controller delegates Match use cases to MatchService.
// Separation of Concerns — PostgreSQL/cache behavior isn't duplicated in API tests.
// Test Doubles — Service and unrelated collaborators are controlled test dependencies.
import { describe, it, expect, vi } from "vitest"
import request from "supertest"
import express from "express"

import { createSeriesRouter }
    from "../../../src/routes/series.routes.js"

import SeriesController
    from "../../../src/controllers/SeriesController.js"


describe("Series API Integration", () => {

    function createSeriesApp({
        series = [],
        seriesById = null,
        matches = []
    } = {}) {

        const seriesService = {

            getSeries:
                vi.fn().mockResolvedValue(series),

            getSeriesById:
                vi.fn().mockResolvedValue(seriesById),

            getMatchesBySeriesId:
                vi.fn().mockResolvedValue(matches)
        }


        const seriesController =
            new SeriesController(seriesService)


        const seriesIdValidationMiddleware = {

            handle:
                vi.fn((req, res, next) => next())
        }


        const seriesRouter =
            createSeriesRouter(
                seriesController,
                seriesIdValidationMiddleware
            )


        const app = express()

        app.use(
            "/api/v1/series",
            seriesRouter
        )


        return {
            app,
            seriesService,
            seriesIdValidationMiddleware
        }
    }


    it("should return all series", async () => {

        const series = [
            {
                id: 1,
                name: "IPL 2026",
                format: "T20",
                status: "ONGOING"
            },
            {
                id: 2,
                name: "Test Championship",
                format: "TEST",
                status: "SCHEDULED"
            }
        ]


        const {
            app,
            seriesService
        } = createSeriesApp({
            series
        })


        const response =
            await request(app)
                .get("/api/v1/series")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: series
            })


        expect(seriesService.getSeries)
            .toHaveBeenCalledOnce()
    })


    it("should return a series by id", async () => {

        const seriesById = {
            id: 1,
            name: "IPL 2026",
            format: "T20",
            status: "ONGOING"
        }


        const {
            app,
            seriesService,
            seriesIdValidationMiddleware
        } = createSeriesApp({
            seriesById
        })


        const response =
            await request(app)
                .get("/api/v1/series/1")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: seriesById
            })


        expect(
            seriesIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            seriesService.getSeriesById
        ).toHaveBeenCalledWith("1")
    })


    it("should return matches for a series", async () => {

        const matches = [
            {
                id: 1001,
                format: "T20",
                status: "LIVE",
                team1_name: "India",
                team2_name: "Australia"
            },
            {
                id: 1002,
                format: "T20",
                status: "SCHEDULED",
                team1_name: "England",
                team2_name: "South Africa"
            }
        ]


        const {
            app,
            seriesService,
            seriesIdValidationMiddleware
        } = createSeriesApp({
            matches
        })


        const response =
            await request(app)
                .get("/api/v1/series/1/matches")


        expect(response.status)
            .toBe(200)


        expect(response.body)
            .toEqual({
                success: true,
                data: matches
            })


        expect(
            seriesIdValidationMiddleware.handle
        ).toHaveBeenCalledOnce()


        expect(
            seriesService.getMatchesBySeriesId
        ).toHaveBeenCalledWith("1")
    })

})
// SRP
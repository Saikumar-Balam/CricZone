import express from "express"


export const createSeriesRouter = (seriesController, seriesIdValidationMiddleware) => {
    const router = express.Router()
    router.get("/", seriesController.getSeries)
    router.get("/:seriesId", seriesIdValidationMiddleware.handle,
        seriesController.getSeriesById
    )
    router.get("/:seriesId/matches", seriesIdValidationMiddleware.handle,
        seriesController.getMatchesBySeriesId
    )
    return router
}
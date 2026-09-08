import express from "express"


export const createNewsRouter = (newsController,
    newsIdValidationMiddleware,
    playerIdValidationMiddleware,
    teamIdValidationMiddleware,
    seriesIdValidationMiddleware,
    matchIdValidationMiddleware
) => {
    const router = express.Router()
    router.get("/", newsController.getNews)
    router.get("/player/:playerId", playerIdValidationMiddleware.handle,
        newsController.getNewsByPlayerId
    )
    router.get("/team/:teamId", teamIdValidationMiddleware.handle,
        newsController.getNewsByTeamId
    )
    router.get("/series/:seriesId", seriesIdValidationMiddleware.handle,
        newsController.getNewsBySeriesId
    )
    router.get("/match/:matchId", matchIdValidationMiddleware.handle, newsController.getNewsByMatchId)

    router.get("/:newsId", newsIdValidationMiddleware.handle,
        newsController.getNewsById
    )

    return router;
}

// The route file creates none of them. They are injected, which keeps DI + SRP + separation of concerns intact
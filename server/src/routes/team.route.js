import express from "express"

export const createTeamRouter = (teamController, teamIdValidationMiddleware) => {
    const router = express.Router()
    router.get("/", teamController.getTeams)
    router.get("/:teamId", teamIdValidationMiddleware.handle,
         teamController.getTeamById)
    router.get("/:teamId/players", teamIdValidationMiddleware.handle,
        teamController.getPlayersByTeamId
    )
    router.get("/:teamId/matches", teamIdValidationMiddleware.handle,
        teamController.getMatchesByTeamId
    )
    router.get("/:teamId/ranking", teamIdValidationMiddleware.handle,
        teamController.getRankingByTeamId
    )
    return router;
}
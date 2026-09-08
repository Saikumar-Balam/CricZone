import express from "express";

export const createStatisticsRouter = (
  statisticsController,
  playerIdValidationMiddleware,
  teamIdValidationMiddleware,
  seriesIdValidationMiddleware
) => {
  const router = express.Router();

  router.get(
    "/players/:playerId",
    playerIdValidationMiddleware.handle,
    statisticsController.getPlayerStatistics
  );

  router.get(
    "/teams/:teamId",
    teamIdValidationMiddleware.handle,
    statisticsController.getTeamStatistics
  );

  router.get(
    "/series/:seriesId",
    seriesIdValidationMiddleware.handle,
    statisticsController.getSeriesStatistics
  );

  return router;
};
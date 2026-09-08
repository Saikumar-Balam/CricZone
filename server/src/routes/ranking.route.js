import express from "express";

export const createRankingRouter = (
  rankingController,
  rankingIdValidationMiddleware,
) => {
  const router = express.Router();

  router.get("/", rankingController.getRankings);
  router.get("/players", rankingController.getPlayerRankings);
  router.get("/teams", rankingController.getTeamRankings);
  router.get(
    "/:rankingId",
    rankingIdValidationMiddleware.handle,
    rankingController.getRankingsById,
  );

  return router;
};

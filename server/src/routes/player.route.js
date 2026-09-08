import express from "express";

export const createPlayerRouter = (
  playerController,
  playerIdValidationMiddleware,
) => {
  const router = express.Router();
  router.get("/", playerController.getPlayers);
  router.get(
    "/:playerId",
    playerIdValidationMiddleware.handle,
    playerController.getPlayersById,
  );
  router.get(
    "/:playerId/statistics",
    playerIdValidationMiddleware.handle,
    playerController.getStatisticsByPlayerId,
  );
  router.get(
    "/:playerId/ranking",
    playerIdValidationMiddleware.handle,
    playerController.getRankingByPlayerId,
  );
  router.get(
    "/:playerId/news",
    playerIdValidationMiddleware.handle,
    playerController.getNewsByPlayerId,
  );

  return router;
};

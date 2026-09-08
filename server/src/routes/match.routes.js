import express from "express";


export const createMatchRouter = (
  matchController,
  matchIdValidationMiddleware,
  scorecardController
) => {
  const router = express.Router();
  router.get("/", matchController.getMatches);
  router.get(
    "/:matchId",
    matchIdValidationMiddleware.handle,
    matchController.getMatchById,
  );

  router.get("/:matchId/scorecard", 
    matchIdValidationMiddleware.handle,
    scorecardController.getScorecardByMatchId
  )
  return router;
};

// Since Scorecard is accessed through a Match:
// we should add the scorecard endpoint to match.routes.js and inject scorecardController, rather than creating a separate /scorecards router.

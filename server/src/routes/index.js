import express from "express";
import devRoutes from "./dev.routes.js"

export const createApiRouter = ({
  matchRouter,
  teamRouter,
  playerRouter,
  seriesRouter,
  venueRouter,
  rankingRouter,
  newsRouter,
  statisticsRouter,
  devRouter
}) => {
  const router = express.Router();
  router.use("/matches", matchRouter);
  router.use("/teams", teamRouter);
  router.use("/players", playerRouter);
  router.use("/series", seriesRouter);
  router.use("/venues", venueRouter);
  router.use("/rankings", rankingRouter);
  router.use("/news", newsRouter);
  router.use("/statistics", statisticsRouter);
  router.use("/dev", devRouter)
  return router;
};
// DIP

// Higher-level modules don't decide which concrete infrastructure implementation exists.

// SRP

// match.routes.js only defines HTTP route mappings.

// Composition Root pattern

// Object creation and dependency wiring are kept outside the business components.

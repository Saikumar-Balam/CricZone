import express from "express";
import NotFoundError from "../errors/NotFoundError.js"

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
   router.use((req, res, next) => {

        next(
            new NotFoundError(
                `Route ${req.method} ${req.originalUrl} was not found`,
                "ROUTE_NOT_FOUND"
            )
        )

    })
  return router;
};
// DIP

// Higher-level modules don't decide which concrete infrastructure implementation exists.

// SRP

// match.routes.js only defines HTTP route mappings.

// Composition Root pattern

// Object creation and dependency wiring are kept outside the business components.

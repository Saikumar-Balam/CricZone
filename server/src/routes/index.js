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
  // runs only in development and testing not in production 
  if(process.env.NODE_ENV !== "production" && devRouter)
  {
  router.use("/dev", devRouter)
  }
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

// Environment Isolation — development-only behavior doesn't leak into production.
// Fail Securely — testing endpoints aren't exposed publicly.
// SRP — routing decides which routes exist; Kafka services don't need production checks.
// Separation of Concerns — deployment behavior stays separate from business logic.
// Configuration Isolation — NODE_ENV controls environment-specific behavior centrally.
// Least Exposure — production exposes only endpoints required by the actual application.

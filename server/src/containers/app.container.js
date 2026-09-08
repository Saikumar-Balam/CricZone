import {
  matchController,
  matchIdValidationMiddleware,
  matchRepository
} from "./match.container.js";

import {
  teamIdValidationMiddleware,
  teamRouter,
  teamRepository
} from "./team.container.js";

import devRouter from "../routes/dev.routes.js"

import {
  playerIdValidationMiddleware,
  playerRouter,
  playerRepository
} from "./player.container.js";

import {
  seriesIdValidationMiddleware,
  seriesRouter,
  seriesRepository
} from "./series.container.js";

import {
  venueRouter
} from "./venue.container.js";

import {
  scorecardController
} from "./scorecard.container.js";

import {
  rankingRouter
} from "./ranking.container.js";

import {
  newsRepository,
  newsIdValidationMiddleware
} from "./news.container.js";

import {
  statisticsRepository
} from "./statistics.container.js";


import NewsService
  from "../services/NewsService.js";

import NewsController
  from "../controllers/NewsController.js";

import StatisticsService
  from "../services/StatisticsService.js";

import StatisticsController
  from "../controllers/StatisticsController.js";


import {
  createMatchRouter
} from "../routes/match.routes.js";

import {
  createNewsRouter
} from "../routes/news.route.js";

import {
  createStatisticsRouter
} from "../routes/statistics.route.js";
import {
  createApiRouter
} from "../routes/index.js"


const matchRouter = createMatchRouter(
  matchController,
  matchIdValidationMiddleware,
  scorecardController
);


const newsService = new NewsService(
  newsRepository,
  matchRepository,
  playerRepository,
  teamRepository,
  seriesRepository
);

const newsController =
  new NewsController(newsService);


const newsRouter = createNewsRouter(
  newsController,
  newsIdValidationMiddleware,
  playerIdValidationMiddleware,
  teamIdValidationMiddleware,
  seriesIdValidationMiddleware,
  matchIdValidationMiddleware
);

const statisticsService =
  new StatisticsService(
    statisticsRepository,
    playerRepository,
    teamRepository,
    seriesRepository
  );

const statisticsController =
  new StatisticsController(
    statisticsService
  );

const statisticsRouter =
  createStatisticsRouter(
    statisticsController,
    playerIdValidationMiddleware,
    teamIdValidationMiddleware,
    seriesIdValidationMiddleware
  );


const apiRouter = createApiRouter({
  matchRouter,
  teamRouter,
  playerRouter,
  seriesRouter,
  venueRouter,
  rankingRouter,
  newsRouter,
  statisticsRouter,
  devRouter
});


export {
  matchRouter,
  newsService,
  newsController,
  newsRouter,
   statisticsService,
  statisticsController,
  statisticsRouter,
  apiRouter
};
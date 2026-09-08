import SeriesController from "../controllers/SeriesController.js";
import SeriesIdValidationMiddleware from "../middleware/SeriesIdValidationMiddleware.js";
import postgresSeriesRepository from "../repositories/postgres/postgresSeriesRepository.js";
import SeriesService from "../services/SeriesService.js";
import SeriesValidator from "../validators/contracts/SeriesValidator.js";
import databaseClient from "./database.container.js"
import {createSeriesRouter} from "../routes/series.routes.js"
import SeriesRequestValidator from "../validators/SeriesRequestValidator.js";

const seriesRepository = new postgresSeriesRepository(databaseClient)
const seriesService = new SeriesService(seriesRepository)
const seriesController = new SeriesController(seriesService)
const seriesValidator = new SeriesRequestValidator()
const seriesIdValidationMiddleware = new SeriesIdValidationMiddleware(seriesValidator)

const seriesRouter =  createSeriesRouter(seriesController, seriesIdValidationMiddleware)

export {
    seriesRepository,
    seriesService,
    seriesController,
    seriesValidator,
    seriesIdValidationMiddleware,
    seriesRouter
}

// LLD principles here: Dependency Injection, Composition Root, DIP support, separation of object creation from business logic.
import VenueController from "../controllers/VenueController.js";
import VenueIdValidationMiddleware from "../middleware/VenueIdValidationMiddleware.js";
import PostgresVenueRepository from "../repositories/postgres/postgresVenueRepository.js";
import VenueService from "../services/VenueService.js";
import VenueRequestValidator from "../validators/VenueRequestValidator.js";
import databaseClient from "./database.container.js"
import { createVenueRouter } from "../routes/venue.routes.js";

const venueRepository = new PostgresVenueRepository(databaseClient)
const venueService = new VenueService(venueRepository)
const venueController = new VenueController(venueService)
const venueValidator = new VenueRequestValidator()
const venueIdValidationMiddleware = new VenueIdValidationMiddleware(venueValidator)

const venueRouter = createVenueRouter(
    venueController,
    venueIdValidationMiddleware
)

export {
    venueRepository,
    venueService,
    venueController,
    venueValidator,
    venueIdValidationMiddleware,
    venueRouter
}

// LLD principles here are Dependency Injection, Composition Root, DIP support, and separation of object construction from business logic.
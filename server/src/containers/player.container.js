import PlayerController from "../controllers/PlayerController.js";
import PlayerIdValidationMiddleware from "../middleware/PlayerIdvalidationMiddleware.js";
import postgresPlayerRepository from "../repositories/postgres/postgresPlayerRepository.js";
import {  createPlayerRouter } from "../routes/player.route.js";
import PlayerService from "../services/PlayerService.js";
import { PlayerRequestValidator } from "../validators/PlayerRequestvalidator.js";
import databaseClient from "./database.container.js"

const playerRepository = new postgresPlayerRepository(databaseClient)
const playerService = new PlayerService(playerRepository)
const playerController = new PlayerController(playerService)
const playerValidator = new PlayerRequestValidator()
const playerIdValidationMiddleware = new PlayerIdValidationMiddleware(playerValidator)

const playerRouter = createPlayerRouter(
    playerController,
    playerIdValidationMiddleware
)

export{
    playerRepository,
    playerService,
    PlayerController,
    playerValidator,
    playerIdValidationMiddleware,
    playerRouter

}

// LLD principles here are Dependency Injection, Composition Root, 
// DIP support, and separation of object construction from business logic.
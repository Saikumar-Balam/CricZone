import PostgresMatchRepository from "../repositories/postgres/postgresMatchRepository.js"
import MatchService from "../services/MatchService.js"
import MatchController from "../controllers/MatchController.js"
import databaseClient from "./database.container.js"
import MatchRequestValidator from "../validators/MatchRequestValidator.js"
import MatchIdValidationMiddleware from "../middleware/MatchIdValidationMiddleware.js"
import { redisCache } from "./redis.container.js"

const matchRepository = new PostgresMatchRepository(databaseClient)
const matchService = new MatchService(matchRepository, redisCache)
const matchController = new MatchController(matchService)

const matchValidator = new MatchRequestValidator()
const matchIdValidationMiddleware = new MatchIdValidationMiddleware(matchValidator)
export {
    matchRepository,
    matchService,
    matchController,
    matchValidator, 
    matchIdValidationMiddleware,
    
}
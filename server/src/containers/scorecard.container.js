import ScorecardController from "../controllers/ScorecardController.js";
import postgresScorecardRepository from "../repositories/postgres/postgresScorecardRepository.js";
import ScorecardService from "../services/ScorecardService.js";
import databaseClient from "./database.container.js"

const scorecardRepository = new postgresScorecardRepository(databaseClient)
const scorecardService = new ScorecardService(scorecardRepository)
const scorecardController = new ScorecardController(scorecardService)

export{
    scorecardRepository,
    scorecardService,
    scorecardController
}
// Notice we are not importing MatchIdValidationMiddleware here. Validation already belongs to the Match module, and the route composition step will inject the existing match validation middleware alongside scorecardController.

// Dependency Injection
// → dependencies are constructor-injected

// Composition Root
// → this file creates the Scorecard object graph

// SRP
// → object construction is separated from business logic

// DIP support
// → service works through ScorecardRepository contract
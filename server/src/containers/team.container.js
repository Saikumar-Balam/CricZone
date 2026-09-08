import databaseClient from "./database.container.js";
import postgresTeamRepository from "../repositories/postgres/postgresTeamRepository.js";
import TeamService from "../services/TeamService.js";
import TeamController from "../controllers/TeamController.js";
import { createTeamRouter } from "../routes/team.route.js";
import TeamIdValidationMiddleware from "../middleware/TeamIdValidationMiddleware.js";
import TeamRequestValidator from "../validators/TeamRequestValidator.js";

const teamRepository = new postgresTeamRepository(databaseClient)
const teamService = new TeamService(teamRepository)
const teamController = new TeamController(teamService)
const teamValidator = new TeamRequestValidator()
const teamIdValidationMiddleware = new TeamIdValidationMiddleware(teamValidator)

const teamRouter = createTeamRouter(
    teamController,
    teamIdValidationMiddleware
)

export{
    teamRepository,
    teamService,
    teamController,
    teamValidator,
    teamIdValidationMiddleware,
    teamRouter
}
// LLD concepts here are Dependency Injection, Composition Root, DIP support, and separation of object construction from business logic.
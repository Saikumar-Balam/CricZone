import RankingController from "../controllers/RankingController.js";
import RankingIdValidationMiddleware from "../middleware/RankingIdValidationMiddleware.js";
import postresRankingRepository from "../repositories/postgres/postgresRankingRepository.js";
import RankingService from "../services/RankingService.js";
import RankingRequestValidator from "../validators/RankingRequestValidator.js";
import databaseClient from "./database.container.js"
import {createRankingRouter} from "../routes/ranking.route.js"

const rankingRepository = new postresRankingRepository(databaseClient)
const rankingService = new RankingService(rankingRepository)
const rankingController = new RankingController(rankingService)
const rankingValidator = new RankingRequestValidator()
const rankingIdValidationMiddleware = new RankingIdValidationMiddleware(rankingValidator)

const rankingRouter = createRankingRouter(
    rankingController,
    rankingIdValidationMiddleware
)

export{
    rankingRepository,
    rankingService,
    rankingController,
    rankingValidator,
    rankingIdValidationMiddleware,
    rankingRouter
}
// This is the composition root for the Ranking module: concrete implementations are created here and injected into higher layers.
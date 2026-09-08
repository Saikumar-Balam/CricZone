import NewsIdValidationMiddleware
  from "../middleware/NewsIdValidationMiddleware.js";

import PostgresNewsRepository
  from "../repositories/postgres/postgresNewsRepository.js";

import NewsRequestValidator
  from "../validators/NewsRequestValidator.js";

import databaseClient
  from "./database.container.js";


const newsRepository =
  new PostgresNewsRepository(databaseClient);

const newsValidator =
  new NewsRequestValidator();

const newsIdValidationMiddleware =
  new NewsIdValidationMiddleware(newsValidator);


export {
  newsRepository,
  newsValidator,
  newsIdValidationMiddleware
};
// This follows Composition Root + DI + SRP properly.
// Notice: we are not creating newsRouter here yet because the News routes also need existing middleware from other modules:
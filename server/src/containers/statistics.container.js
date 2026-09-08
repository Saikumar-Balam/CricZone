import PostgresStatisticsRepository
  from "../repositories/postgres/postgresStatisticsRepository.js";

import databaseClient
  from "./database.container.js";


const statisticsRepository =
  new PostgresStatisticsRepository(databaseClient);


export {
  statisticsRepository
};
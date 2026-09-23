import databaseConfig  from "../config/database.config.js"
import PostgresDatabaseClient from "../database/postgres/PostgresDatabaseClient.js";
import PostgresRetryStrategy from "../database/postgres/PostgresRetryStrategy.js";

const retryStrategy = new PostgresRetryStrategy({
    maxRetries: 2,
    baseDelayMs: 200
})

const databaseClient = new PostgresDatabaseClient(
    databaseConfig,
    retryStrategy 
)
export default databaseClient
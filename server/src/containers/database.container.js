import databaseConfig  from "../config/database.config.js"
import PostgresDatabaseClient from "../database/postgres/PostgresDatabaseClient.js";

const databaseClient = new PostgresDatabaseClient(
    databaseConfig.connectionString
)
export default databaseClient
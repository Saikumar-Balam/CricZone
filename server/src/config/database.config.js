 const isProduction = process.env.NODE_ENV === "production"
 const databaseConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? {
        rejectUnauthorized: true
    }
    : false,
    max: Number(process.env.DB_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
    statementTimeoutMillis: Number(process.env.DB_STATEMENT_TIMEOUT_MS || 10000)
}
export default databaseConfig;

// SRP — database.config.js defines configuration; PostgresDatabaseClient manages DB operations.
// DI — database configuration is injected into the client.
// DIP — repositories depend on the database abstraction rather than PostgreSQL/TLS details.
// Configuration Isolation — production TLS policy is centralized.
// Separation of Concerns — repositories/services remain unaware of TLS.
// Fail Securely — production certificate verification remains enabled.

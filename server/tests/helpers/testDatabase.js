import PostgresDatabaseClient from "../../src/database/postgres/PostgresDatabaseClient.js"
import dotenv from "dotenv"

 dotenv.config({
        path: ".env.test"
    })

export function createTestDatabase()
{
    const connectionString = process.env.TEST_DATABASE_URL
   
    if(!connectionString)
    {
        throw new Error("TEST_DATABASE_URL is not configured")
    }
    return new PostgresDatabaseClient({connectionString,
        // Neon requires TLS
        ssl: {
            rejectUnauthorized: true,
        },
        // Test-specific pool configuration
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000,
        statementTimeoutMillis: 5000
    })
}
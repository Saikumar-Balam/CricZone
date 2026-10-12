// Concrete PostgreSQL DB implementation


import pg from "pg";
import DatabaseClient from "../contracts/DatabaseClient.js";

const { Pool } = pg;

export default class PostgresDatabaseClient extends DatabaseClient {
    constructor(config, retryStrategy = null) {
        super();

        this.retryStrategy = retryStrategy;

        const statementTimeoutMillis = Number(
            config.statementTimeoutMillis
        );

        if (
            !Number.isSafeInteger(statementTimeoutMillis) ||
            statementTimeoutMillis <= 0
        ) {
            throw new Error("Invalid PostgreSQL statement timeout");
        }

        this.pool = new Pool({
            connectionString: config.connectionString,
            ssl: config.ssl,
            max: config.max,
            idleTimeoutMillis: config.idleTimeoutMillis,
            connectionTimeoutMillis: config.connectionTimeoutMillis,

            onConnect: async (client) => {
                await client.query(
                    `SET statement_timeout = ${statementTimeoutMillis}`
                );
            }
        });

        // Handle errors emitted by idle pooled clients.
        this.pool.on("error", (error) => {
            console.error("PostgreSQL idle pool client error", {
                code: error.code,
                message: error.message
            });
        });
    }

    async connect() {
        const client = await this.pool.connect();

        try {
            await client.query("SELECT 1");
        } finally {
            client.release();
        }
    }

    async getClient() {
        return this.pool.connect();
    }

    async query(sql, params = []) {
        return this.pool.query(sql, params);
    }

    async queryWithRetry(sql, params = []) {
        const operation = () => this.pool.query(sql, params);

        if (!this.retryStrategy) {
            return operation();
        }

        // Caller must ensure this operation is replay-safe.
        return this.retryStrategy.execute(operation);
    }

    async healthCheck() {
        try {
            await this.pool.query("SELECT 1");

            return {
                healthy: true
            };
        } catch (error) {
            return {
                healthy: false,
                error
            };
        }
    }

    async disconnect() {
        await this.pool.end();
    }
}


// DI — complete pool configuration is injected.
// DIP — PostgresDatabaseClient doesn't depend directly on environment variables.
// Composition Root — database.container.js assembles the concrete dependency.
// Encapsulation — repositories/services know nothing about pg.Pool.
// Open/Closed Principle — pool behavior can change through configuration without modifying repositories.

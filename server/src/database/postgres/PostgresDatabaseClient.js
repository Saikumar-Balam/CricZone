// concrete DB Implementation

import pg from "pg";
import DatabaseClient from "../contracts/DatabaseClient.js";

const { Pool } = pg;

export default class PostgresDatabaseClient extends DatabaseClient {
  constructor(config) {
    super();
    this.pool = new Pool({
      connectionString: config.connectionString,
      ssl: config.ssl,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      statementTimeoutMillis: config.statementTimeoutMillis
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
  async disconnect() {
    await this.pool.end();
  }
}

// DI — complete pool configuration is injected.
// DIP — PostgresDatabaseClient doesn't depend directly on environment variables.
// Composition Root — database.container.js assembles the concrete dependency.
// Encapsulation — repositories/services know nothing about pg.Pool.
// Open/Closed Principle — pool behavior can change through configuration without modifying repositories.

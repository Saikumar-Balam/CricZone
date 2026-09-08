// concrete DB Implementation

import pg from "pg"
import DatabaseClient from "../contracts/DatabaseClient.js"

const {Pool} = pg

export default class PostgresDatabaseClient extends DatabaseClient{
    constructor(connectionString)
    {
        super();
        this.pool = new Pool({
            connectionString,
        })
    }
    async connect()
    {
        const client = await this.pool.connect()
        try{
            await client.query("SELECT 1")
        }
        finally{
            client.release()
        }
    }
    async query(sql, params=[])
    {
        return this.pool.query(sql, params)
    }
    async disconnect()
    {
        await this.pool.end()
    }
}
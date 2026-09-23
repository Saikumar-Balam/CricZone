// Db Abstraction

export default class DatabaseClient
{
    async connect()
    {
        throw new Error("connect() must be implemented")
    }

    async getClient()
    {
        throw new Error("getClient() must be implemented")
    }
    
    async query(sql, params=[])
    {
        throw new Error("query() must be implemented")
    }

    async healthCheck()
    {
        throw new Error("healthCheck() must be implemented")
    }

    async disconnect()
    {
        throw new Error("disconnect() must be implemented")
    }
}

// SRP — DB client handles DB connectivity; config handles configuration.
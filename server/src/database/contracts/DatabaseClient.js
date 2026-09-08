// Db Abstraction

export default class DatabaseClient
{
    async connect()
    {
        throw new Error("connect() must be implemented")
    }
    async query(sql, params=[])
    {
        throw new Error("query() must be implemented")
    }
    async disconnect()
    {
        throw new Error("disconnect() must be implemented")
    }
}
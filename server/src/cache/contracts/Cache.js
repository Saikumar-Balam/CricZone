export default class Cache {
    async get(key)
    {
        throw new Error("get() must be Implemented")
    }

    async set(key, value, ttlSeconds)
    {
        throw new Error("get() must be implemented")
    }

    async delete(key)
    {
        throw new Error("delete() must be implemented")
    }
}

// Abstraction 
// DIP          foundation
// OCP         
// LSP         
// SRP         
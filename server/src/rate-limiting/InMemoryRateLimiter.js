import RateLimiter from "./contracts/RateLimiter.js";

export default class InMemoryRateLimiter extends RateLimiter {
    constructor({
        limit =100, 
        windowMs = 60 * 1000
    } = {})
    {
        super()
        this.limit = limit
        this.windowMs = windowMs
        this.clients = new Map() // to store the requests of the clients
    }

    async consume(key)
    {
        const now = Date.now()
        const client =  this.clients.get(key)
        if(!client || now>=client.resetAt)
        {
            const resetAt = now + this.windowMs
            this.clients.set(key, {
                count:1,
                resetAt
            })

            return {
                allowed: true,
                remaining: this.limit - 1,
                resetAt
            }
        }
        if(client.count>=this.limit)
        {
            return{
                allowed: false,
                remaining: 0,
                resetAt: client.resetAt
            }
        }
        client.count+=1

        return {
            allowed: true,
            remaining: this.limit - client.count,
            resetAt: client.resetAt
        }
    }
}

// SRP            
// Abstraction    
// LSP            
// OCP           
// Encapsulation  
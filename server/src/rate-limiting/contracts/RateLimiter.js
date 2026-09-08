export default class RateLimiter
{
    async consume(key)
    {
        throw new Error("consume() must be implemented")
    }
}
// LLD principles here are mainly DIP, OCP, LSP, SRP, and abstraction.
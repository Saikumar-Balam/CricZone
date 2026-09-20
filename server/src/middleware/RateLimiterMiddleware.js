export default class RateLimiterMiddleware 
{
    constructor(rateLimiter)
    {
        this.rateLimiter = rateLimiter
        this.handle = this.handle.bind(this)
    }

    async handle(req, res, next)
    {
        try{
            const key = req.ip
            const result = await this.rateLimiter.consume(key)
            const resetInSeconds = Math.max(Math.ceil((result.resetAt - Date.now())/1000), 0)
            res.setHeader("X-RateLimit-Remaining", result.remaining)
            res.setHeader("X-RateLimit-Reset", Math.ceil(result.resetAt/1000))
            if(!result.allowed)
            {
                res.setHeader("Retry-After", resetInSeconds)
                return res.status(429).json({
                    success: false,
                    error:{
                        code: "RATE_LIMIT_EXCEEDED",
                        message: 
                            "Too many requests. Please try again later.",
                        requestId: req.requestId
                    }
                })
            }
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}
// SRP    RateLimitMiddleware only handles HTTP rate-limit behavior

// DI     RateLimiter injected through constructor

// DIP    Middleware depends on RateLimiter behavior,
//          not InMemoryRateLimiter directly

// OCP    Swap InMemoryRateLimiter → RedisRateLimiter
//          without changing middleware

// LSP    Any correct RateLimiter implementation works
// Separation of Concerns 
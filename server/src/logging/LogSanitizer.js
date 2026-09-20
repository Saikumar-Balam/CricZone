export default class LogSanitizer{
    constructor()
    {
        this.sensitiveKeys = new Set([
            "password",
            "token",
            "accesstoken",
            "refreshtoken",
            "authorization",
            "cookie",
            "set-cookie",
            "apikey",
            "secret",
            "kafkapassword"
        ])
    }
    sanitize(metadata)
    {
        return this.sanitizeValue(metadata)
    }

    sanitizeValue(value)
    {
        if(Array.isArray(value))
        {
            return value.map((item) => this.sanitizeValue(item))
        }
        if(value !== null && typeof value === "object")
        {
            const sanitized = {}
            for(const[key, item] of Object.entries(value))
            {
                if(this.isSensitive(key))
                {
                    sanitized[key] = "[REDACTED]"
                    continue
                }
                sanitized[key] = this.sanitizeValue(item)

                
            }
            return sanitized
        }
        return value
    }
    isSensitive(key)
    {
        return this.sensitiveKeys.has(key.toLowerCase())
    }
}

// SRP — sanitizer only handles log sanitization.
// Encapsulation — sensitive-key logic stays inside LogSanitizer.
// Recursion — nested objects/arrays are sanitized consistently.
// OCP — new sensitive keys can be added without changing the logger.
// Separation of Concerns — logger logs; sanitizer sanitizes.
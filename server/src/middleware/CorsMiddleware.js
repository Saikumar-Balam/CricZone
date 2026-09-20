
import cors from "cors"
import AppError from "../errors/AppError.js"

export default class CorsMiddleware {
    constructor(allowedOrigins = [])
    {
        this.allowedOrigins = allowedOrigins
        this.middleware = cors({
            origin: this.validateOrigin,
            methods: ["GET", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Accept"
            ]
        })
    }

    validateOrigin = (origin, callback) => {
        // Requests without an Origin headers are not browsers
        // cross-origin requests (Postman, server-to-server, etc...)
        if(!origin)
        {
            return callback(null, true)
        }

        if(this.allowedOrigins.includes(origin))
        {
            return callback(null, true)
        }
        return callback(new AppError(
            "Origin not allowed by CORS",
            403,
            "CORS_ORIGIN_FORBIDDEN"
        ))
    }

    handle = (req, res, next) => {
        return this.middleware(req, res, next)
    }
}
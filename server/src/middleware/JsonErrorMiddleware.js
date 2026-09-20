import AppError from "../errors/AppError.js"

export default class JsonErrorMiddleware {
    handle = (err, req, res, next) => {
        if(err instanceof SyntaxError && err.status === 400 && "body" in err)
        {
            return next(AppError(
                "Malformed JSON request body",
                400, 
                "INVALID_JSON"
            ))
        }
        // Request body exceeds express.json() limit
        if(err.type === "entity.too.large")
        {
            return next(new AppError(
                "Request payload too large",
                413,
                "PAYLOAD_TOO_LARGE"
            ))
        }
        return next(err)
    }
}
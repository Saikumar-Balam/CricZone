import crypto from "crypto"

export default class RequestIDMiddleware
{
    handle(req, res, next)
    {
        const incomingRequestId = req.headers["x-request-id"]
        const requestId = incomingRequestId || crypto.randomUUID()
        req.requestId = requestId
        res.setHeader(
            "X-Request-Id",
            requestId
        )
        next()
    }
}
// So it follows SRP and keeps the cross-cutting concerns separated.
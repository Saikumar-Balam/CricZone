import crypto from "crypto"

export default class RequestIDMiddleware
{
    handle(req, res, next)
    {
        const incomingRequestId = req.headers["x-request-id"]
        const requestId = incomingRequestId || crypto.randomUUID()
        const incomingTraceId = req.headers["x-trace-id"]
        const traceId = incomingTraceId || crypto.randomUUID()
        req.requestId = requestId
        req.traceId = traceId
        res.setHeader(
            "X-Request-Id",
            requestId
        )
        res.setHeader(
            "X-Trace-Id",
            traceId
        )
        next()
    }
}

// SRP — manages request correlation/tracing identifiers.
//
// Separation of concerns — correlation context is handled
// independently from controllers and business logic.
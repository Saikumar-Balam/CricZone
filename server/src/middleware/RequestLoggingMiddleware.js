export default class RequestLoggingMiddleware
{
    constructor(logger)
    {
        this.logger = logger
        this.handle = this.handle.bind(this)
    }

    handle(req, res, next)
    {
        const startTime = Date.now()
        res.on("finish", () => {
            const durationMs = Date.now() - startTime
            this.logger.info(
                "HTTP request completed",
                {
                    requestId: req.requestId,
                    method: req.method,
                    path: req.originalUrl,
                    statusCode: res.statusCode,
                    durationMs
                }
            )
        })
        next()
    }
}
// SRP
// RequestLoggingMiddleware only handles HTTP request logging.

// DIP
// It depends on the Logger abstraction rather than a concrete
// logging implementation.

// DI
// Logger is supplied through the constructor.

// OCP
// We can replace StructuredLogger with another Logger
// without modifying this middleware.

// LSP
// Any implementation satisfying Logger can be injected.

// Separation of Concerns
// Request ID generation and request logging remain
// different middleware classes.
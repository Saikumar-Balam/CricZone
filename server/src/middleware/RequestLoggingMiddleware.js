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
                    traceId: req.traceId,
                    method: req.method,
                    path: req.path,
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

// SRP — request middleware logs request metadata only.
// Defense in Depth — safe request logging plus centralized sanitization.
// Data Minimization — log only information needed for observability.
// Separation of Concerns — request logging and secret sanitization remain separate.
// Encapsulation — callers don't need to know how LogSanitizer performs redaction.
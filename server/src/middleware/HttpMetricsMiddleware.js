export default class HttpMetricsMiddleware {
    constructor(metrics)
    {
        this.metrics = metrics
        this.handle = this.handle.bind(this)
    }

    handle(req, res, next) {
        const startTime = Date.now()
        res.on("finish", () => {
            const duration = Date.now() - startTime
            const labels = {
                method: req.method,
                route: req.route?.path || req.path,
                status: String(res.statusCode)
            }
            this.metrics.incrementCounter("http_requests_total", 1, labels)
            this.metrics.observeHistogram("http_request_duration_ms", duration, {
                method: req.method,
                route: req.route?.path || req.path
            })
            if(res.statusCode>=400)
            {
                this.metrics.incrementCounter("http_errors_total", 1, {
                    method: req.method,
                    route: req.route?.path || req.path,
                    status: String(res.statusCode)
                })
            }
        })
        next()
    }
}

// lld 
// SRP (Single Responsibility Principle) — the middleware has one responsibility: measure HTTP request count, duration, and errors.
// DIP (Dependency Inversion Principle) — it depends on the Metrics abstraction through this.metrics, not directly on PrometheusMetrics.
// Dependency Injection (DI) — the metrics dependency is injected through constructor(metrics).
// Separation of Concerns — metrics logic stays in middleware instead of being repeated inside controllers/services.
// OCP (Open/Closed Principle) — you can replace PrometheusMetrics with another Metrics implementation without changing this middleware.
// Encapsulation — HTTP metrics behavior is contained inside HttpMetricsMiddleware.
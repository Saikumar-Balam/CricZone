export default class Tracer {
    startSpan(name, options = {})
    {
        throw new Error("startSpan() must be implemented")
    }

    getCurrentTraceId()
    {
        throw new Error("getCurrentTrace() must be implemented")
    }

    getCurrentSpanId()
    {
        throw new Error("getCurrentSpan() must be implemented")
    }
}

// Abstraction
// → Tracer and Span expose tracing behavior without
//   exposing the tracing vendor/library.

// DIP
// → Application components can depend on Tracer
//   rather than OpenTelemetry directly.

// OCP
// → We can add OpenTelemetryTracer later without
//   changing the contract.

// LSP
// → Any valid Tracer implementation can replace
//   another implementation.

// SRP
// → Tracer handles tracing operations.
// → Span represents an individual traced operation.

// DI
// → Concrete tracer will later be injected into
//   components that need tracing.

// Testability
// → Tests can inject a fake/no-op tracer instead
//   of running a real tracing backend.
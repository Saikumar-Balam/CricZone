export default class Span {
    setAttributes(name, value)
    {
        throw new Error("setAttribute() must be implemented")
    }

    recordException(error)
    {
        throw new Error("recordException() must be implemented")
    }

    end()
    {
        throw new Error("end() must be implemented")
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
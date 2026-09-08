export default class Logger{
    info(message, metadata = {})
    {
        throw new Error("Method info() must be Implemented")
    }
    
    warn(message, metadata = {})
    {
        throw new Error("Method warn() must be implemented")
    }

    error(message, metadata = {})
    {
        throw new Error("Method error() must be implemented")
    }

    debug(message, metadata = {})
    {
        throw new Error("Method debug() must be implemented")
    }
}

// DIP  → depend on Logger abstraction
// OCP  → add new logger implementations without modifying consumers
// LSP  → implementations can substitute each other
// SRP  → Logger contract only defines logging behavior
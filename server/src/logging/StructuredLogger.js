import Logger from "./contracts/Logger.js";

export default class StructuredLogger extends Logger
{
    constructor(logSanitizer, minLevel = "INFO")
    {
        super()
        this.logSanitizer = logSanitizer
        this.minlevel = minLevel
        this.levels = {
            DEBUG: 10,
            INFO: 20,
            WARN: 30,
            ERROR: 40
        }
    }
    info(message, metadata = {})
    {
        this.log("INFO", message, metadata)
    }

    warn(message, metadata = {})
    {
        this.log("WARN", message, metadata)
    }

    error(message, metadata = {})
    {
        this.log("ERROR", message, metadata)
    }

    debug(message, metadata = {})
    {
        this.log("DEBUG", message, metadata)
    }

    log(level, message, metadata = {})
    {
        if(!this.shouldLog(level))
        {
            return
        }
        const SanitizedMetadata = this.logSanitizer.sanitize(metadata)
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...SanitizedMetadata
        }
        console.log(JSON.stringify(logEntry))
    }
    shouldLog(level)
    {
        return (this.levels[level] >= this.levels[this.minlevel])
    }
}

// SRP          
// Abstraction  
// LSP          
// OCP     
// DRY          
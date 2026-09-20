import LogSanitizer from "../logging/LogSanitizer.js";
import StructuredLogger from "../logging/StructuredLogger.js";

const logSanitizer = new LogSanitizer()
const logLevel = process.env.NODE_ENV === "production" ? "INFO" : process.env.NODE_ENV === "test" ? "ERROR" : "DEBUG"
const logger = new StructuredLogger(logSanitizer, logLevel)

export {logger, logSanitizer}
// logger.container.js
//         ↓
// creates ONE StructuredLogger instance
//         ↓
//      logger
//       /   \
//      ↓     ↓
// HTTP       Redis
// logging    logging


// SRP — StructuredLogger owns logging and level filtering; LogSanitizer owns sanitization.
// DI — sanitizer and minimum log level are injected.
// OCP — logging behavior changes through configuration without changing callers.
// Encapsulation — callers simply use logger.debug/info/warn/error.
// Environment Isolation — development, test and production have appropriate logging behavior.
// Data Minimization — production avoids unnecessary debug information.
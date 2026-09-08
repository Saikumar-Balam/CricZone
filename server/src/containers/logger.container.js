import StructuredLogger from "../logging/StructuredLogger.js";

const logger = new StructuredLogger()

export {logger}
// logger.container.js
//         ↓
// creates ONE StructuredLogger instance
//         ↓
//      logger
//       /   \
//      ↓     ↓
// HTTP       Redis
// logging    logging
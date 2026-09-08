import AppError from "../errors/AppError.js"

export const createErrorHandler = (logger) => {
    return (err, req, res, next) => {
        if(err instanceof AppError)
        {
            logger.error("HTTP request failed",{
                requestId: req.requestId,
                method: req.method,
                path: req.originalPath,
                statusCode: err.statusCode,
                errorCode: err.code,
                errorMessage: err.message
            })
       

        return res.status(err.statusCode).json({
            success: false,
            error:{
                code: err.code,
                messgae: err.messgae,
                requestId: req.requestId
            }
        })
    }
        logger.error("Unhandled HTTP request error", {
            requestId: req.requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode: 500,
            errorCode: "INTERNAL_SERVER_ERROR",
            errorMessage: err.message,
            stack:
                process.env.NODE_ENV === "production"
                ? undefined
                : err.stack
        })
        
        return res.status(500).json({
            success: false,
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Something went wrong",
                requestId: req.requestId
            }
        })
    }
} 

// DI                       
// DIP                      
// SRP                      
// OCP                      
// LSP                      
// Separation of Concerns   
// Factory function   

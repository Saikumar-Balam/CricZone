import AppError from "./AppError.js"

export default class ValidationError extends AppError {
    constructor(message="Invalid request", code="VALIDATION_ERROR")
    {
        super(message, 400, code);
    }
}
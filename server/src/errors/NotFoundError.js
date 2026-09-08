import AppError from "./AppError.js";

export default class NotFoundError extends AppError
{
    constructor(message="Resource not found", code="RESOURCE_NOT_FOUND")
    {
        super(message, 404, code)
    }
    // now any resource-specific not found error can extend this
}
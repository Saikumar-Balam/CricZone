import NotFoundError from "./NotFoundError.js";

export default class SeriesNotFoundError extends NotFoundError
{
    constructor(seriesId)
    {
        super(`Series with id ${seriesId} was not found`,
            "SERIES_NOT_FOUND"
        )
    }
}

// LLD principles here:

// SRP → only represents Series-not-found.
// OCP → adds a new error without modifying base error classes.
// LSP → can be handled anywhere AppError is expected.
// Inheritance → common 404 behavior stays centralized.
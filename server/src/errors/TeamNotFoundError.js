import NotFoundError from "./NotFoundError.js";

export default class TeamNotFoundError extends NotFoundError
{
    constructor(teamId)
    {
        super(`Team with id ${teamId} was not found`,
            "TEAM_NOT_FOUND"
        )
    }
}

// SRP
// → TeamNotFoundError represents only the Team-not-found case.

// OCP
// → We added TeamNotFoundError without changing NotFoundError/AppError.

// LSP
// → TeamNotFoundError can be handled anywhere an AppError is expected.

// Inheritance
// → common 404 behaviour remains in NotFoundError.
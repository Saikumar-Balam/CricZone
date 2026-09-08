import TeamValidationMiddleware from "./contracts/TeamValidationMiddleware.js";

export default class TeamIdValidationMiddleware extends TeamValidationMiddleware {
    constructor(teamValidator)
    {
        super()
        this.teamValidator = teamValidator
        this.handle = this.handle.bind(this)
    }
    handle(req, res, next)
    {
        try{
            const teamId = this.teamValidator.validateTeamId(req.params.teamId)
            req.params.teamId = teamId
            next()
        }
        catch(error)
        {
            next(error)
        }
    }
}
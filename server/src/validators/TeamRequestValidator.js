import ValidationError from "../errors/ValidationError.js";
import TeamValidator from "./contracts/TeamValidator.js";

export default class TeamRequestValidator extends TeamValidator
{
    validateTeamId(teamId)
    {
        const id = Number(teamId);
        if(!Number.isInteger(id) || id<=0)
        {
            throw new ValidationError("teamId must be a positive integer", "INVALID_TEAM_ID")
        }
        return id;
    }
}
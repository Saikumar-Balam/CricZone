import ValidationError from "../errors/ValidationError.js";
import PlayerValidator from "./contracts/PlayerValidator.js";

export class PlayerRequestValidator extends PlayerValidator {
    validatePlayerId(playerId)
    {
        const id = Number(playerId)
        if(!Number.isInteger(id) || id<=0){
            throw new ValidationError("playerId must be a postive integer",
                "INVALID_PLAYER_ID"
            )
        }
        return id;
    }
}
// LLD principles used here are abstraction, SRP, OCP, LSP, and DIP support.
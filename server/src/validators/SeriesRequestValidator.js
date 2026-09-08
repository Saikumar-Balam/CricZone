import SeriesValidator from "./contracts/SeriesValidator.js";
import ValidationError from "../errors/ValidationError.js"

export default class SeriesRequestValidator extends SeriesValidator
{
    validateSeriesId(seriesId)
    {
        const id = Number(seriesId)
        if(!Number.isInteger(id) || id<=0)
        {
            throw new ValidationError("seriesId must be a positive integer",
                "INVALID_SERIES_ID"
            )
        }
        return id
    }
}
// This keeps validation rules outside the controller/service and gives us SRP, abstraction, OCP, LSP, and DIP support.
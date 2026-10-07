import { API_BASE_URL } from "../config/api.config.js";

class MatchService {
    async getAllMatches()
    {
        const response = await fetch(`${API_BASE_URL}/api/v1/matches`, {
            method: "GET",
            headers: {
                Accept: "application/json"
            },
        })
        if(!response.ok)
        {
            throw new Error(`Failed to fetch matches: ${response.status}`)
        }
        const body = await response.json()
        if(!body.success || !Array.isArray(body.data))
        {
            throw new Error("Invalid matches response from server")
        }
        return body.data
    }

}

const matchService = new MatchService()
export default matchService
export default class TeamController
{
    constructor(teamService)
    {
        this.teamService = teamService
        this.getTeams = this.getTeams.bind(this)
        this.getTeamById = this.getTeamById.bind(this)
        this.getPlayersByTeamId = this.getPlayersByTeamId.bind(this)
        this.getMatchesByTeamId = this.getMatchesByTeamId.bind(this)
        this.getRankingByTeamId = this.getRankingByTeamId.bind(this)
    }
    async getTeams(req, res, next) 
    {
        try{
            const teams = await this.teamService.getTeams()
            return res.status(200).json({
                success: true,
                data: teams
            })
        }
        catch(error)
        {
            next(error)
        }
    }

    async getTeamById(req, res, next) 
    {
        try{
            const {teamId} = req.params
            const team = await this.teamService.getTeamById(teamId)
            return res.status(200).json({
                success: true,
                data: team
            })
        }
        catch(error)
        {
            next(error)
        }
    }

    async getPlayersByTeamId(req, res, next)
    {
        try{
        const {teamId} = req.params
        const players = await this.teamService.getPlayersByTeamId(teamId)
        return res.status(200).json({
            success: true,
            data: players
        })
    }
    catch(error)
    {
        next(error)
    }
    }

    async getMatchesByTeamId(req, res, next) 
    {
        try{
            const {teamId} = req.params
            const matches = await this.teamService.getMatchesByTeamId(teamId)
            return res.status(200).json({
                success: true, 
                data: matches
            })
        }
        catch(error)
        {
            next(error)
        }
    }
    async getRankingByTeamId(req, res, next) {
        try{
            const{teamId} = req.params
            const ranking = await this.teamService.getRankingByTeamId(teamId)
            return res.status(200).json({
                success: true, 
                data: ranking
            })
        }
        catch(error)
        {
            next(error)
        }
    }

}
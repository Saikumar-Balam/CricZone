export default class MatchController
{
  constructor(MatchService)
  {
    this.MatchService = MatchService
    this.getMatches = this.getMatches.bind(this)
    this.getMatchById = this.getMatchById.bind(this)
  }
  async getMatches(req, res, next) 
  {
    try{
      const matches = await this.MatchService.getMatches()
      return res.status(200).json({
        sucees: true,
        data: matches
      })
    }
    catch(error)
    {
      next(error)
    }
  }

  async getMatchById(req, res, next)
  {
    try{
    const {matchId} = req.params
    const match = await this.MatchService.getMatchById(matchId)
    return res.status(200).json({
      success: true,
      data: match,
    })
  }
  catch(error){
    next(error)
  }
  }
}

// SRP → controller handles HTTP only.
// DI → MatchService is constructor-injected.
// DIP → controller depends on its service behavior, not infrastructure.
// Separation of Concerns → HTTP logic is separated from business and persistence logic.
export default class RankingController {
  constructor(rankingService) {
    this.rankingService = rankingService;
    this.getRankings = this.getRankings.bind(this);
    this.getRankingsById = this.getRankingsById.bind(this);
    this.getPlayerRankings = this.getPlayerRankings.bind(this);
    this.getTeamRankings = this.getTeamRankings.bind(this);
  }

  async getRankings(req, res, next) {
    try {
      const rankings = await this.rankingService.getRankings();
      return res.status(200).json({
        success: true,
        data: rankings,
      });
    } catch (error) {
      next(error);
    }
  }

  async getRankingsById(req, res, next) {
    try {
      const { rankingId } = req.params;
      const rankings = await this.rankingService.getRankingsById(rankingId);
      return res.status(200).json({
        success: true,
        data: rankings,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPlayerRankings(req, res, next) 
  {
    try{
        const rankings = await this.rankingService.getPlayerRankings()
        return res.status(200).json({
            success: true,
            data: rankings
        })
    }
    catch(error)
    {
        next(error)
    }
  }

  async getTeamRankings(req, res, next)
  {
    try{
        const rankings = await this.rankingService.getTeamRankings()
        return res.status(200).json({
            success: true,
            data: rankings
        })
    }
    catch(error)
    {
        next(error)
    }
  }
}
// LLD principles: SRP, constructor DI, separation of concerns, testability.

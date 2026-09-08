export default class ScorecardController {
  constructor(scorecardService) {
    this.scorecardService = scorecardService;
    this.getScorecardByMatchId = this.getScorecardByMatchId.bind(this);
  }

  async getScorecardByMatchId(req, res, next) {
    try {
      const { matchId } = req.params;
      const scorecard =
        await this.scorecardService.getScorecardByMatchId(matchId);
      return res.status(200).json({
        success: true,
        data: scorecard,
      });
    } catch (error) {
      next(error);
    }
  }
}

// LLD principles here are SRP, constructor DI, separation of concerns, and testability.

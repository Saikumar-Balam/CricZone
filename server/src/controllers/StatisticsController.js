export default class StatisticsController {
  constructor(statisticsService) {
    this.statisticsService = statisticsService;

    this.getPlayerStatistics =
      this.getPlayerStatistics.bind(this);

    this.getTeamStatistics =
      this.getTeamStatistics.bind(this);

    this.getSeriesStatistics =
      this.getSeriesStatistics.bind(this);
  }


  async getPlayerStatistics(req, res, next) {
    try {
      const { playerId } = req.params;

      const statistics =
        await this.statisticsService
          .getPlayerStatistics(playerId);

      return res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }


  async getTeamStatistics(req, res, next) {
    try {
      const { teamId } = req.params;

      const statistics =
        await this.statisticsService
          .getTeamStatistics(teamId);

      return res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }


  async getSeriesStatistics(req, res, next) {
    try {
      const { seriesId } = req.params;

      const statistics =
        await this.statisticsService
          .getSeriesStatistics(seriesId);

      return res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }
}

// LLD principles here: SRP, constructor DI, separation of concerns, and testability.
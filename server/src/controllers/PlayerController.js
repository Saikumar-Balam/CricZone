export default class PlayerController {
  constructor(playerService) {
    this.playerService = playerService;
    this.getPlayers = this.getPlayers.bind(this);
    this.getPlayersById = this.getPlayersById.bind(this);
    this.getStatisticsByPlayerId = this.getStatisticsByPlayerId.bind(this);
    this.getRankingByPlayerId = this.getRankingByPlayerId.bind(this)
    this.getNewsByPlayerId = this.getNewsByPlayerId.bind(this);
  }

  async getPlayers(req, res, next) {
    try {
      const players = await this.playerService.getPlayers();
      return res.status(200).json({
        success: true,
        data: players,
      });
    } catch (error) {
      next(error);
    }
  }

  async getPlayersById(req, res, next) {
    try {
      const { playerId } = req.params;
      const player = await this.playerService.getPlayersById(playerId);
      return res.status(200).json({
        success: true,
        data: player,
      });
    } catch (error) {
      next(error);
    }
  }

  async getStatisticsByPlayerId(req, res, next) 
  {
    try{
    const {playerId} = req.params
    const statistics = await this.playerService.getStatisticsByPlayerId(playerId)
    return res.status(200).json({
        success: true,
        data: statistics
    })
    }
    catch(error)
    {
        next(error)
    }
  }


  async getRankingByPlayerId(req, res, next)
  {
    try{
      const {playerId} = req.params;
      const rankings = await this.playerService.getRankingByPlayerId(playerId)
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

  async getNewsByPlayerId(req, res, next)
  {
    try{
        const {playerId} = req.params 
        const news = await this.playerService.getNewsByPlayerId(playerId)
        return res.status(200).json({
            success: true,
            data: news
        })
    }
    catch(error)
    {
        next(error)
    }
  }
}
// LLD principles used here are SRP, constructor DI, separation of concerns, and testability.

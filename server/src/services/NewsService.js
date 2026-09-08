import NewsNotFoundError from "../errors/NewsNotFoundError.js";
import MatchNotFoundError from "../errors/MatchNotFoundError.js";
import PlayerNotFoundError from "../errors/PlayerNotFoundError.js";
import TeamNotFoundError from "../errors/TeamNotFoundError.js";
import SeriesNotFoundError from "../errors/SeriesNotFoundError.js";

export default class NewsService {
  constructor(
    newsRepository,
    matchRepository,
    playerRepository,
    teamRepository,
    seriesRepository
  ) {
    this.newsRepository = newsRepository;
    this.matchRepository = matchRepository;
    this.playerRepository = playerRepository;
    this.teamRepository = teamRepository;
    this.seriesRepository = seriesRepository;
  }

  async getNews() {
    return await this.newsRepository.findAll();
  }

  async getNewsById(newsId) {
    const news = await this.newsRepository.findById(newsId);

    if (!news) {
      throw new NewsNotFoundError(newsId);
    }

    return news;
  }

  async getNewsByPlayerId(playerId) {
    const player =
      await this.playerRepository.findById(playerId);

    if (!player) {
      throw new PlayerNotFoundError(playerId);
    }

    return await this.newsRepository.findByPlayerId(playerId);
  }

  async getNewsByTeamId(teamId) {
    const team =
      await this.teamRepository.findById(teamId);

    if (!team) {
      throw new TeamNotFoundError(teamId);
    }

    return await this.newsRepository.findByTeamId(teamId);
  }

  async getNewsBySeriesId(seriesId) {
    const series =
      await this.seriesRepository.findById(seriesId);

    if (!series) {
      throw new SeriesNotFoundError(seriesId);
    }

    return await this.newsRepository.findBySeriesId(seriesId);
  }

  async getNewsByMatchId(matchId) {
    const match =
      await this.matchRepository.findById(matchId);

    if (!match) {
      throw new MatchNotFoundError(matchId);
    }

    return await this.newsRepository.findByMatchId(matchId);
  }
}

// LLD principles here are Service Layer Pattern, SRP, constructor DI, DIP, and separation of persistence from application logic.

import PlayerNotFoundError
  from "../errors/PlayerNotFoundError.js";

import TeamNotFoundError
  from "../errors/TeamNotFoundError.js";

import SeriesNotFoundError
  from "../errors/SeriesNotFoundError.js";


export default class StatisticsService {
  constructor(
    statisticsRepository,
    playerRepository,
    teamRepository,
    seriesRepository
  ) {
    this.statisticsRepository = statisticsRepository;
    this.playerRepository = playerRepository;
    this.teamRepository = teamRepository;
    this.seriesRepository = seriesRepository;
  }


  async getPlayerStatistics(playerId) {
    const player =
      await this.playerRepository.findById(playerId);

    if (!player) {
      throw new PlayerNotFoundError(playerId);
    }

    const statistics =
      await this.statisticsRepository
        .findPlayerStatistics(playerId);

    return {
      player: {
        id: player.id,
        name: player.name,
        country: player.country,
        role: player.role,
        teams: player.teams ?? []
      },

      formatStatistics:
        statistics.formatStatistics ?? [],

      competitionStatistics:
        statistics.competitionStatistics ?? []
    };
  }


  async getTeamStatistics(teamId) {
    const team =
      await this.teamRepository.findById(teamId);

    if (!team) {
      throw new TeamNotFoundError(teamId);
    }

    const statistics =
      await this.statisticsRepository
        .findTeamStatistics(teamId);

    return {
      team: {
        id: team.id,
        name: team.name,
        shortName: team.short_name,
        country: team.country
      },

      formatStatistics:
        statistics.formatStatistics ?? [],

      competitionStatistics:
        statistics.competitionStatistics ?? []
    };
  }


  async getSeriesStatistics(seriesId) {
    const series =
      await this.seriesRepository.findById(seriesId);

    if (!series) {
      throw new SeriesNotFoundError(seriesId);
    }

    const statistics =
      await this.statisticsRepository
        .findSeriesStatistics(seriesId);

    return {
      series: {
        id: series.id,
        name: series.name,
        format: series.format,
        status: series.status
      },

      statistics
    };
  }
}
// LLD principles: Service Layer, SRP, constructor DI, DIP, orchestration, and separation of business validation from aggregate persistence logic.
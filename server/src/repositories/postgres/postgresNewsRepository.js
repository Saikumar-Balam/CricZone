import NewsRepository from "../contracts/NewsRepository.js";

export default class PostgresNewsRepository extends NewsRepository {
  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }


  async findAll() {
    const query = `
      SELECT
        n.id,
        n.title,
        n.content,
        n.image_url,
        n.published_at

      FROM news n

      ORDER BY n.published_at DESC;
    `;

    const result =
      await this.databaseClient.query(query);

    return result.rows;
  }


  async findById(newsId) {
    const query = `
      SELECT
        n.id,
        n.title,
        n.content,
        n.image_url,
        n.published_at

      FROM news n

      WHERE n.id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [newsId]
      );

    return result.rows[0] ?? null;
  }


  async findByPlayerId(playerId) {
    const query = `
      SELECT
        n.id,
        n.title,
        n.content,
        n.image_url,
        n.published_at

      FROM news n

      JOIN news_players np
        ON np.news_id = n.id

      WHERE np.player_id = $1

      ORDER BY n.published_at DESC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [playerId]
      );

    return result.rows;
  }


  async findByTeamId(teamId) {
    const query = `
      SELECT
        n.id,
        n.title,
        n.content,
        n.image_url,
        n.published_at

      FROM news n

      JOIN news_teams nt
        ON nt.news_id = n.id

      WHERE nt.team_id = $1

      ORDER BY n.published_at DESC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [teamId]
      );

    return result.rows;
  }


  async findBySeriesId(seriesId) {
    const query = `
      SELECT
        n.id,
        n.title,
        n.content,
        n.image_url,
        n.published_at

      FROM news n

      JOIN news_series ns
        ON ns.news_id = n.id

      WHERE ns.series_id = $1

      ORDER BY n.published_at DESC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [seriesId]
      );

    return result.rows;
  }


  async findByMatchId(matchId) {
    const query = `
      SELECT
        n.id,
        n.title,
        n.content,
        n.image_url,
        n.published_at

      FROM news n

      JOIN news_matches nm
        ON nm.news_id = n.id

      WHERE nm.match_id = $1

      ORDER BY n.published_at DESC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [matchId]
      );

    return result.rows;
  }
}


// Repository Pattern:
// PostgreSQL-specific News queries stay here.

// SRP:
// This repository handles News persistence/read operations only.

// Constructor DI:
// databaseClient is injected.

// DIP:
// NewsService depends on NewsRepository abstraction.

// LSP:
// Another NewsRepository implementation can replace this one.
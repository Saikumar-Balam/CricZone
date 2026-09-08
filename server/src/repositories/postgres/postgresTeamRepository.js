import TeamRepository from "../contracts/TeamRepository.js";

export default class PostgresTeamRepository extends TeamRepository {
  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }


  async findAll() {
    const query = `
      SELECT
        id,
        name,
        short_name,
        country,
        logo_url

      FROM teams

      ORDER BY name ASC;
    `;

    const result =
      await this.databaseClient.query(query);

    return result.rows;
  }


  async findById(teamId) {
    const query = `
      SELECT
        id,
        name,
        short_name,
        country,
        logo_url

      FROM teams

      WHERE id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [teamId]
      );

    return result.rows[0] ?? null;
  }


  // ---------------------------------------------
  // PLAYER ↔ TEAM MANY-TO-MANY RELATIONSHIP
  // Uses player_teams instead of players.team_id
  // ---------------------------------------------

  async findPlayersByTeamId(teamId) {
    const query = `
      SELECT DISTINCT
        p.id,
        p.name,
        p.country,
        p.role,
        p.batting_style,
        p.bowling_style,
        p.image_url

      FROM players p

      LEFT JOIN player_teams pt
        ON pt.player_id = p.id

      WHERE
        pt.team_id = $1

        OR (
          pt.player_id IS NULL
          AND p.team_id = $1
        )

      ORDER BY p.name ASC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [teamId]
      );

    return result.rows;
  }


  // ---------------------------------------------
  // TEAM MATCHES
  // Uses normalized match_formats
  // Falls back to matches.format during migration
  // ---------------------------------------------

  async findMatchesByTeamId(teamId) {
    const query = `
      SELECT
        m.id,

        COALESCE(
          mf.code,
          m.format
        ) AS format,

        m.status,
        m.start_time,
        m.result,

        s.id AS series_id,
        s.name AS series_name,

        t1.id AS team1_id,
        t1.name AS team1_name,
        t1.short_name AS team1_short_name,

        t2.id AS team2_id,
        t2.name AS team2_name,
        t2.short_name AS team2_short_name

      FROM matches m

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      JOIN series s
        ON m.series_id = s.id

      JOIN teams t1
        ON m.team1_id = t1.id

      JOIN teams t2
        ON m.team2_id = t2.id

      WHERE
        m.team1_id = $1
        OR m.team2_id = $1

      ORDER BY m.start_time DESC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [teamId]
      );

    return result.rows;
  }


  async findRankingByTeamId(teamId) {
    const query = `
      SELECT
        id,
        format,
        category,
        position,
        rating,
        updated_at

      FROM rankings

      WHERE team_id = $1

      ORDER BY
        format,
        category;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [teamId]
      );

    return result.rows;
  }
}


// Repository Pattern:
// PostgreSQL-specific queries stay inside this implementation.

// SRP:
// This repository handles Team persistence/read operations only.

// Constructor DI:
// databaseClient is injected from the composition root.

// DIP:
// TeamService depends on TeamRepository abstraction.

// LSP:
// Another TeamRepository implementation can substitute this class.
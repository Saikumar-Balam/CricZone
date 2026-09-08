import PlayerRepository from "../contracts/PlayerRepository.js";

export default class PostgresPlayerRepository
  extends PlayerRepository {

  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }

  async findAll() {
    const query = `
      SELECT
        p.id,
        p.name,
        p.country,
        p.role,
        p.batting_style,
        p.bowling_style,
        p.image_url,

        /*
         * Legacy team fields.
         * Keep temporarily so existing APIs do not break.
         */
        legacy_team.id AS team_id,
        legacy_team.name AS team_name,
        legacy_team.short_name AS team_short_name,

        /*
         * New many-to-many team relationship.
         */
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', team_data.id,
                'name', team_data.name,
                'short_name', team_data.short_name
              )
              ORDER BY team_data.name
            )

            FROM (
              /*
               * Preferred new relationship
               */
              SELECT
                t.id,
                t.name,
                t.short_name

              FROM player_teams pt

              JOIN teams t
                ON pt.team_id = t.id

              WHERE pt.player_id = p.id


              UNION


              /*
               * Temporary fallback for players
               * not yet migrated to player_teams
               */
              SELECT
                t.id,
                t.name,
                t.short_name

              FROM teams t

              WHERE t.id = p.team_id

                AND NOT EXISTS (
                  SELECT 1
                  FROM player_teams pt2
                  WHERE pt2.player_id = p.id
                )

            ) team_data
          ),

          '[]'::json
        ) AS teams

      FROM players p

      LEFT JOIN teams legacy_team
        ON p.team_id = legacy_team.id

      ORDER BY p.name ASC;
    `;

    const result =
      await this.databaseClient.query(query);

    return result.rows;
  }

  async findById(playerId) {
    const query = `
      SELECT
        p.id,
        p.name,
        p.country,
        p.role,
        p.batting_style,
        p.bowling_style,
        p.image_url,

        /*
         * Legacy compatibility fields
         */
        legacy_team.id AS team_id,
        legacy_team.name AS team_name,
        legacy_team.short_name AS team_short_name,

        /*
         * New many-to-many relationship
         */
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', team_data.id,
                'name', team_data.name,
                'short_name', team_data.short_name
              )
              ORDER BY team_data.name
            )

            FROM (
              SELECT
                t.id,
                t.name,
                t.short_name

              FROM player_teams pt

              JOIN teams t
                ON pt.team_id = t.id

              WHERE pt.player_id = p.id


              UNION


              SELECT
                t.id,
                t.name,
                t.short_name

              FROM teams t

              WHERE t.id = p.team_id

                AND NOT EXISTS (
                  SELECT 1
                  FROM player_teams pt2
                  WHERE pt2.player_id = p.id
                )

            ) team_data
          ),

          '[]'::json
        ) AS teams

      FROM players p

      LEFT JOIN teams legacy_team
        ON p.team_id = legacy_team.id

      WHERE p.id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [playerId]
      );

    return result.rows[0] ?? null;
  }

  async findStatisticsByPlayerId(playerId) {
    const query = `
      SELECT
        p.id AS player_id,
        p.name,

        COALESCE(
          bat.total_runs,
          0
        ) AS total_runs,

        COALESCE(
          bat.balls_faced,
          0
        ) AS balls_faced,

        COALESCE(
          bat.fours,
          0
        ) AS fours,

        COALESCE(
          bat.sixes,
          0
        ) AS sixes,

        COALESCE(
          bowl.total_wickets,
          0
        ) AS total_wickets,

        COALESCE(
          bowl.runs_conceded,
          0
        ) AS runs_conceded

      FROM players p


      /*
       * Aggregate batting independently.
       * Prevents batting × bowling row multiplication.
       */
      LEFT JOIN (
        SELECT
          player_id,
          SUM(runs) AS total_runs,
          SUM(balls_faced) AS balls_faced,
          SUM(fours) AS fours,
          SUM(sixes) AS sixes

        FROM batting_performances

        GROUP BY player_id
      ) bat
        ON bat.player_id = p.id


      /*
       * Aggregate bowling independently.
       */
      LEFT JOIN (
        SELECT
          player_id,
          SUM(wickets) AS total_wickets,
          SUM(runs_conceded) AS runs_conceded

        FROM bowling_performances

        GROUP BY player_id
      ) bowl
        ON bowl.player_id = p.id


      WHERE p.id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [playerId]
      );

    return result.rows[0] ?? null;
  }

  async findRankingByPlayerId(playerId) {
    const query = `
      SELECT
        id,
        format,
        category,
        position,
        rating,
        updated_at

      FROM rankings

      WHERE player_id = $1

      ORDER BY
        format,
        category;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [playerId]
      );

    return result.rows;
  }


  // ==================================================
  // PLAYER NEWS
  // ==================================================

  async findNewsByPlayerId(playerId) {
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
}


// Repository Pattern:
// PostgreSQL-specific persistence logic stays here.

// SRP:
// This class handles Player data retrieval only.

// Constructor DI:
// databaseClient is injected.

// DIP:
// PlayerService depends on PlayerRepository abstraction.

// LSP:
// Another implementation can substitute this repository.
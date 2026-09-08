import MatchRepository from "../contracts/matchRepository.js";

export default class PostgresMatchRepository extends MatchRepository {
  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }


  async findAll() {
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

        v.id AS venue_id,
        v.name AS venue_name,
        v.city AS venue_city,

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

      JOIN venues v
        ON m.venue_id = v.id

      JOIN teams t1
        ON m.team1_id = t1.id

      JOIN teams t2
        ON m.team2_id = t2.id

      ORDER BY m.start_time DESC;
    `;

    const result =
      await this.databaseClient.query(query);

    return result.rows;
  }


  async findById(matchId) {
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

        v.id AS venue_id,
        v.name AS venue_name,
        v.city AS venue_city,

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

      JOIN venues v
        ON m.venue_id = v.id

      JOIN teams t1
        ON m.team1_id = t1.id

      JOIN teams t2
        ON m.team2_id = t2.id

      WHERE m.id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [matchId]
      );

    return result.rows[0] ?? null;
  }
}

// Repository Pattern:
// SQL/database details are isolated in the concrete repository.

// DIP:
// MatchService depends on MatchRepository abstraction.

// DI:
// databaseClient is constructor-injected.

// SRP:
// this class only retrieves Match data from PostgreSQL.

// LSP:
// another MatchRepository implementation can replace this one.
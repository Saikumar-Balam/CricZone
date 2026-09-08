import SeriesRepository
  from "../contracts/SeriesRepositories.js";

export default class PostgresSeriesRepository
  extends SeriesRepository {

  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }


  async findAll() {
    const query = `
      SELECT
        id,
        name,
        format,
        start_date,
        end_date,
        status,
        created_at,
        updated_at

      FROM series

      ORDER BY start_date DESC;
    `;

    const result =
      await this.databaseClient.query(query);

    return result.rows;
  }


  async findById(seriesId) {
    const query = `
      SELECT
        id,
        name,
        format,
        start_date,
        end_date,
        status,
        created_at,
        updated_at

      FROM series

      WHERE id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [seriesId]
      );

    return result.rows[0] ?? null;
  }


  async findMatchesBySeriesId(seriesId) {
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

      LEFT JOIN venues v
        ON m.venue_id = v.id

      JOIN teams t1
        ON m.team1_id = t1.id

      JOIN teams t2
        ON m.team2_id = t2.id

      WHERE m.series_id = $1

      ORDER BY m.start_time ASC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [seriesId]
      );

    return result.rows;
  }
}


// Repository Pattern:
// PostgreSQL-specific Series queries stay here.

// SRP:
// This class handles Series persistence/read operations only.

// Constructor DI:
// databaseClient is injected.

// DIP:
// SeriesService depends on SeriesRepository abstraction.

// LSP:
// Another repository implementation can substitute this one.
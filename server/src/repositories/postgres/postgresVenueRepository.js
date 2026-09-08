import VenueRepository from "../contracts/VenueRepository.js";

export default class PostgresVenueRepository extends VenueRepository {
  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }

  async findAll() {
    const query = `
      SELECT
        id,
        name,
        city,
        country,
        created_at,
        updated_at

      FROM venues

      ORDER BY name ASC;
    `;

    const result =
      await this.databaseClient.query(query);

    return result.rows;
  }

  async findById(venueId) {
    const query = `
      SELECT
        id,
        name,
        city,
        country,
        created_at,
        updated_at

      FROM venues

      WHERE id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [venueId]
      );

    return result.rows[0] ?? null;
  }

  async findMatchesByVenueId(venueId) {
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

      LEFT JOIN series s
        ON m.series_id = s.id

      JOIN teams t1
        ON m.team1_id = t1.id

      JOIN teams t2
        ON m.team2_id = t2.id

      WHERE m.venue_id = $1

      ORDER BY m.start_time DESC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [venueId]
      );

    return result.rows;
  }
}


// Repository Pattern:
// PostgreSQL-specific Venue queries stay here.

// SRP:
// This repository handles Venue persistence/read operations only.

// Constructor DI:
// databaseClient is injected.

// DIP:
// VenueService depends on VenueRepository abstraction.

// LSP:
// Another VenueRepository implementation can replace this one.
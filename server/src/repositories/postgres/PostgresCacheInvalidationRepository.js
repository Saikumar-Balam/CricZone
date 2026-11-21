
export default class PostgresCacheInvalidationRepository {
  constructor(databaseClient) {
    this.databaseClient = databaseClient;
  }

  async hasPendingInvalidation(matchId) {
    const result = await this.databaseClient.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM public.cache_invalidation_outbox
          WHERE match_id = $1
            AND status <> 'COMPLETED'
        ) AS has_pending
      `,
      [matchId]
    );

    return result.rows[0].has_pending;
  }
}

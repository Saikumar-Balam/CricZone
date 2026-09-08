export const CacheKeys = {
    matchById: (matchId) => 
        `match:${matchId}`,

    scorecardByMatchId: (matchId) =>
        `scorecard:${matchId}`,

    playerById: (playerId) =>
        `player:${playerId}`,

    teamById: (teamId) =>
        `team:${teamId}`,

    seriesById: (seriesId) =>
        `series:${seriesId}`,

    venueById: (venueId) =>
        `venue:${venueId}`,

    ranking: (type, format) =>
        `ranking:${type}:${format}`,

    playerStatistics: (playerId) =>
        `statistics:${playerId}`,

    teamStatistics: (teamId) =>
        `statistics:${teamId}`,

    seriesStatistics: (seriesId) =>
        `statistics:${seriesId}`

}
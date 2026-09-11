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
        `statistics:player:${playerId}`,

    teamStatistics: (teamId) =>
        `statistics:team:${teamId}`,

    seriesStatistics: (seriesId) =>
        `statistics:series:${seriesId}`,

    // live-match caches
    matchLive: (matchId) =>
        `match:${matchId}:live`,

    matchSummary: (matchId) =>
        `match:${matchId}:summary`,

    matchCommentary: (matchId) =>
        `match:${matchId}:commentary`


}
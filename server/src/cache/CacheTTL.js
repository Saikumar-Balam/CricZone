export const CacheTTL = {
    // Live match caches
    LIVE_MATCH: 60,
    MATCH_SUMMARY: 60,
    SCORECARD:60,
    COMMENTARY: 300,

    // general entity cache
    MATCH: 60,
    
    PLAYER: 300,
    TEAM: 300,
    SERIES: 300,
    VENUE: 600,

    RANKING: 120,

    NEWS: 60,

    STATISTICS: 120,

    // completed match cache
    COMPLETED_MATCH: {
        SUMMARY: 3600,
        SCORECARD: 3600,
        COMMENTARY: 3600
    },

    // not a TTL, but configuration for commentary cache
    COMMENTARY_LIMIT: 100
}
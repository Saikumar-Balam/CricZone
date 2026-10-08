import crypto from "crypto"

const testEventIds = new Set()

export function createTestEventId() {
    const eventId = crypto.randomUUID()
    testEventIds.add(eventId)
    return eventId
}


export async function ensureScorecardFixture(database) {
    // Match 2 exists in the CI seed data.
    // Ensure its scorecard exists.
    await database.query(`
        INSERT INTO scorecards (match_id)
        SELECT 2
        WHERE NOT EXISTS (
            SELECT 1 FROM scorecards WHERE match_id = 2
        )
    `);

    const scorecardResult = await database.query(`
        SELECT id
        FROM scorecards
        WHERE match_id = 2
    `);

    const scorecardId = scorecardResult.rows[0]?.id;

    if (!scorecardId) {
        throw new Error("Test scorecard for match 2 is missing");
    }

    // Create the innings expected by the existing test payload.
    await database.query(`
        INSERT INTO innings (
            id,
            scorecard_id,
            batting_team_id,
            innings_number,
            total_runs,
            wickets,
            overs,
            extras,
            legal_balls,
            current_striker_id,
            current_non_striker_id,
            current_bowler_id
        )
        SELECT
            6, $1, 1, 1,
            42, 0, 5.2, 30, 32, 1, 2, 5
        WHERE NOT EXISTS (
            SELECT 1 FROM innings WHERE id = 6
        )
    `, [scorecardId]);

    // Create striker performance.
    await database.query(`
        INSERT INTO batting_performances (
            innings_id,
            player_id,
            runs,
            balls_faced,
            fours,
            sixes,
            strike_rate
        )
        SELECT 6, 1, 2, 2, 0, 0, 100
        WHERE NOT EXISTS (
            SELECT 1
            FROM batting_performances
            WHERE innings_id = 6 AND player_id = 1
        )
    `);

    // Create bowler performance.
    await database.query(`
        INSERT INTO bowling_performances (
            innings_id,
            player_id,
            overs,
            maidens,
            runs_conceded,
            wickets,
            economy,
            balls_bowled
        )
        SELECT 6, 5, 5.2, 0, 14, 0, 2.625, 32
        WHERE NOT EXISTS (
            SELECT 1
            FROM bowling_performances
            WHERE innings_id = 6 AND player_id = 5
        )
    `);
}


export async function resetScorecardFixture(database)
{
    // Innings baseline
    await database.query(`
        update innings
        set 
        total_runs = 42,
        wickets = 0,
        extras = 30,
        legal_balls = 32,
        current_striker_id = 1,
        current_non_striker_id = 2,
        current_bowler_id = 5
        where id = 6`)

    // Striker basleine
    await database.query(`
        update batting_performances
        set 
        runs = 2,
        balls_faced = 2,
        fours = 0,
        sixes = 0
        where innings_id = 6
        and player_id = 1`)

    // Bowler baseline
    await database.query(`
        update bowling_performances
        set 
        balls_bowled = 32,
        runs_conceded = 14,
        wickets = 0,
        overs = 5.2,
        economy = 2.625
        where innings_id = 6
        and player_id = 5`)
}

export async function cleanupTestEvents(database)
{
    if(testEventIds.size === 0)
    {
        return 
    }

    const eventIds = [...testEventIds]
    // 1st remove the commentary rows that reference deliveries created by our tests
    await database.query(`
        delete from commentary_events
        where delivery_id in (
        select id
        from deliveries
        where event_id = ANY($1::uuid[]))`, [eventIds])

    // then remove deliveries themselves
    await database.query(`
        delete from deliveries
        where event_id = ANY($1::uuid[])`, [eventIds])

    testEventIds.clear()
}

export async function cleanupScorecardTest(database)
{
    await cleanupTestEvents(database)
    await resetScorecardFixture(database)
}
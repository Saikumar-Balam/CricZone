import crypto from "crypto"

const testEventIds = new Set()

export function createTestEventId() {
    const eventId = crypto.randomUUID()
    testEventIds.add(eventId)
    return eventId
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
    if(testEventIds.length === 0)
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
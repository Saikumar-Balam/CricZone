import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createTestDatabase } from "../../helpers/testDatabase.js";
import postgresScorecardRepository from "../../../src/repositories/postgres/postgresScorecardRepository.js";
import crpyto from "crypto";
import { createBallPayload } from "./postgresFixtures.js";
import { createTestEventId, resetScorecardFixture, cleanupScorecardTest } from "../../helpers/postgresScorecardTestIsolation.js";

describe("postgresScorecardRepository Integration", () => {
  let database;
  let repository;
   beforeAll(async () => {
    database = createTestDatabase();
    await database.connect();
    repository = new postgresScorecardRepository(database);
  });
  beforeEach(async () => {
    await resetScorecardFixture(database)
  })

 
 afterEach(async () => {
    await cleanupScorecardTest(database)
  })
  afterAll(async () => {
    if (database) {
      await database.disconnect();
    }
  });

  it("should record a ball successfully", async () => {
    // Arrange
    const eventId = createTestEventId();
    const payload = createBallPayload()
   
    // Act
    const result = await repository.recordBall(eventId, payload);
    // Assert
    expect(result).toBeDefined();
    expect(result.delivery).toBeDefined();
    expect(result.updatedInnings).toBeDefined();
    expect(result.updatedBowling).toBeDefined();
    expect(result.updatedScorecard).toBeDefined();
    expect(result.commentaryEvent).toBeDefined();
    expect(result.delivery.event_id).toBe(eventId);
  });
afterEach(async () => {
    await cleanupScorecardTest(database)
})
beforeEach(async () => {
    await resetScorecardFixture(database)
})
  it("should persist delivery correctly", async () => {
    // Arrange
    const eventId = createTestEventId()
    const payload = createBallPayload()
    // Act
    await repository.recordBall(eventId, payload)
    // Assert
    const result = await database.query(`
        select * from deliveries
        where event_id = $1`, [eventId])

    expect(result.rows).toHaveLength(1)
    const delivery = result.rows[0]

    expect(delivery.event_id).toBe(eventId)
    expect(Number(delivery.match_id)).toBe(payload.matchId)
    expect(Number(delivery.innings_id)).toBe(payload.inningsId)
    expect(Number(delivery.over_number)).toBe(payload.overNumber)
    expect(Number(delivery.ball_number)).toBe(payload.ballNumber)
    expect(Number(delivery.striker_id)).toBe(payload.strikerId)
    expect(Number(delivery.non_striker_id)).toBe(payload.nonStrikerId)
    expect(Number(delivery.bowler_id)).toBe(payload.bowlerId)
    expect(Number(delivery.batsman_runs)).toBe(payload.runs.batsman)
    expect(Number(delivery.extra_runs)).toBe(payload.runs.extras)
    expect(Number(delivery.total_runs)).toBe(payload.runs.total)
    expect(delivery.is_four).toBe(true)
    expect(delivery.is_six).toBe(false)
    expect(delivery.is_wicket).toBe(false)
    expect(delivery.is_legal_delivery).toBe(true)
  })
afterEach(async () => {
    await cleanupScorecardTest(database)
})
beforeEach(async () => {
    await resetScorecardFixture(database)
})
  it("should update innings correctly after recording a ball", async () => {
    // Arrange
    const eventId = createTestEventId()
    const payload = createBallPayload()
    const beforeResult = await database.query(`
        select total_runs,
        wickets,
        extras,
        legal_balls
        from innings 
        where id = $1`, [payload.inningsId])

    const before = beforeResult.rows[0]
    // Act
    await repository.recordBall(eventId, payload)
    // Assert
    const afterResult = await database.query(`select
        total_runs,
        wickets,
        extras,
        legal_balls
        from innings
        where id = $1`, [payload.inningsId])

    const after = afterResult.rows[0]
    expect(Number(after.total_runs)).toBe(Number(before.total_runs) + payload.runs.total)
    expect(Number(after.extras)).toBe(Number(before.extras) + payload.runs.extras)
    expect(Number(after.legal_balls)).toBe(Number(before.legal_balls) + (payload.legalDelivery? 1 : 0))
    expect(Number(after.wickets)).toBe(Number(before.wickets) + (payload.wicket.occurred ? 1 : 0))
  })
  afterEach(async () => {
    await cleanupScorecardTest(database)
  })
beforeEach(async () => {
    await resetScorecardFixture(database)
})
  it("should update batting performance correctly", async () => {
    // Arrange
    const eventId = createTestEventId()
    const payload = createBallPayload()

    const beforeResult = await database.query(`
        select 
        runs,
        balls_faced,
        fours,
        sixes
        from batting_performances
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.strikerId])

    const before = beforeResult.rows[0]

    // Act
    await repository.recordBall(eventId, payload)
    // Assert
    const afterResult = await database.query(`
        select
        runs,
        balls_faced,
        fours,
        sixes
        from batting_performances
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.strikerId])
    
    const after = afterResult.rows[0]
    // Assert
    expect(Number(after.runs)).toBe(Number(before.runs) + payload.runs.batsman)
    expect(Number(after.balls_faced)).toBe(Number(before.balls_faced) + (payload.legalDelivery ? 1 : 0))
    expect(Number(after.fours)).toBe(Number(before.fours) + (payload.boundary.four ? 1 : 0))
    expect(Number(after.sixes)).toBe(Number(before.sixes) + (payload.boundary.six ? 1 : 0))
  })
  afterEach(async () => {
    await cleanupScorecardTest(database)
  })
  beforeEach(async () => {
    await resetScorecardFixture(database)
  })
  it("should update the bowling performance correctly", async () => {
    // Arrange
    const eventId = createTestEventId()
    const payload = createBallPayload()

    const beforeResult = await database.query(`
        select 
        balls_bowled,
        runs_conceded,
        wickets,
        overs,
        economy
        from bowling_performances
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.bowlerId])

    const before = beforeResult.rows[0]

    // Act
    await repository.recordBall(eventId, payload)
    // Assert

    const afterResult = await database.query(`
        select
        balls_bowled,
        runs_conceded,
        wickets,
        overs,
        economy
        from bowling_performances 
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.bowlerId])

    const after = afterResult.rows[0]

    const expectedBalls = Number(before.balls_bowled) + (payload.legalDelivery ? 1 : 0)
    const expectedRunsConcedeed = Number(before.runs_conceded) + payload.runs.total - payload.extras.bye - payload.extras.legBye

    const bowlerWicketTypes = [
        "BOWLED",
        "CAUGHT",
        "STUMPED",
        "LBW",
        "HIT_WICKET"
    ]
    const expectedWickets = Number(before.wickets) + (payload.wicket.occurred && bowlerWicketTypes.includes(payload.wicket.type) ? 1 : 0)
    expect(Number(after.balls_bowled)).toBe(expectedBalls)
    expect(Number(after.runs_conceded)).toBe(expectedRunsConcedeed)
    expect(Number(after.wickets)).toBe(expectedWickets)
  })
  afterEach(async () => {
    await cleanupScorecardTest(database)
  })
beforeEach(async () => {
    await resetScorecardFixture(database)
})
  it("should prevent duplicate event processing", async () => {
    // Arrange
    const eventId = createTestEventId()
    const payload = createBallPayload()

    const inningsBeforeResult = await database.query(`
        select
        total_runs,
        wickets,
        extras,
        legal_balls
        from innings
        where id = $1`, [payload.inningsId])
    
    const battingBeforeResult = await database.query(`
        select 
        runs,
        balls_faced,
        fours,
        sixes
        from batting_performances
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.strikerId])
    
    const bowlingBeforeResult = await database.query(`
        select
        balls_bowled,
        runs_conceded,
        wickets
        from bowling_performances
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.bowlerId])
    
    const inningsBefore = inningsBeforeResult.rows[0]
    const battingBefore = battingBeforeResult.rows[0]
    const bowlingBefore = bowlingBeforeResult.rows[0]

    // Act- first processing
    const firstResult = await repository.recordBall(eventId, payload)
    // Act- duplicate processing
    const secondResult = await repository.recordBall(eventId, payload)

    // Assert duplicate response
    expect(firstResult.duplicate).not.toBe(true)
    expect(secondResult.duplicate).toBe(true)

    // Verify only 1 delivery exists
    const deliveryResult = await database.query(`
        select count(*)::int as count
        from deliveries
        where event_id = $1`, [eventId])

    // Verify final innings state
    const inningsAfterResult = await database.query(`
        select 
        total_runs,
        wickets,
        extras,
        legal_balls
        from innings
        where id = $1`, [payload.inningsId])
    
    const inningsAfter = inningsAfterResult.rows[0]
    expect(Number(inningsAfter.total_runs)).toBe(Number(inningsBefore.total_runs) + payload.runs.total)
    expect(Number(inningsAfter.legal_balls)).toBe(Number(inningsBefore.legal_balls) + (payload.legalDelivery ? 1 : 0))
    
    // verify batting update only once
    const battingAfterResult = await database.query(`
        select
        runs,
        balls_faced,
        fours,
        sixes
        from batting_performances
        where innings_id = $1 and 
        player_id = $2`, [payload.inningsId, payload.strikerId])

    const battingAfter = battingAfterResult.rows[0]
    expect(Number(battingAfter.runs)).toBe(Number(battingBefore.runs) + payload.runs.batsman)
    expect(Number(battingAfter.balls_faced)).toBe(Number(battingBefore.balls_faced) + (payload.legalDelivery ? 1 : 0))

    // Verify bowling updates
    const bowlingAfterResult = await database.query(`
        select
        balls_bowled,
        runs_conceded,
        wickets
        from bowling_performances
        where innings_id = $1 
        and player_id = $2`, [payload.inningsId, payload.bowlerId])

    const bowlingAfter = bowlingAfterResult.rows[0]

    expect(Number(bowlingAfter.balls_bowled)).toBe(Number(bowlingBefore.balls_bowled) + (payload.legalDelivery ? 1 : 0))
    expect(Number(bowlingAfter.runs_conceded)).toBe(Number(bowlingBefore.runs_conceded) + payload.runs.total - payload.extras.bye - payload.extras.legBye)
  })
afterEach(async () => {
    await cleanupScorecardTest(database)
})
beforeEach(async () => {
    await resetScorecardFixture(database)
})

  it("should rollback transaction when recordBall falls", async () => {
    // Arrange
    const eventId = crpyto.randomUUID()
    const payload = createBallPayload()
    const inningsBeforeResult = await database.query(`
        select 
        total_runs,
        wickets,
        extras,
        legal_balls 
        from innings
        where id = $1`, [payload.inningsId])
    
    const battingBeforeResult = await database.query(`
        select
        runs,
        balls_faced,
        fours,
        sixes
        from batting_performances
        where innings_id = $1 
        and player_id = $2`, [payload.inningsId, payload.strikerId])

    const bowlingBeforeResult = await database.query(`
        select 
        balls_bowled,
        runs_conceded,
        wickets
        from bowling_performances
        where innings_id = $1 
        and player_id = $2`, [payload.inningsId, payload.bowlerId])

    const inningsBefore = inningsBeforeResult.rows[0]
    const battingBefore = battingBeforeResult.rows[0]
    const bowlingBefore = bowlingBeforeResult.rows[0]

    // Force repository failure
    await database.query(`
        update bowling_performances
        set balls_bowled = 60
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.bowlerId])
    
    // Act + Assert
    await expect(repository.recordBall(eventId, payload)).rejects.toThrow("Bowler ball limit exceeded")

    // Verify delivery was rolled back
    const deliveryResult = await database.query(`
        select COUNT(*)::int as count
        from deliveries
        where event_id = $1`, [eventId])
    
    expect(deliveryResult.rows[0].count).toBe(0)

    // verify innings unchanged
    const inningsAfterResult = await database.query(`
        select 
        total_runs,
        wickets,
        extras,
        legal_balls 
        from innings
        where id = $1`, [payload.inningsId])

    const inningsAfter = inningsAfterResult.rows[0]
    expect(Number(inningsAfter.total_runs)).toBe(Number(inningsBefore.total_runs))
    expect(Number(inningsAfter.wickets)).toBe(Number(inningsBefore.wickets))
    expect(Number(inningsAfter.extras)).toBe(Number(inningsBefore.extras))
    expect(Number(inningsAfter.legal_balls)).toBe(Number(inningsBefore.legal_balls))

    // Verify batting unchanged
    const battingAfterResult = await database.query(`
        select 
        runs,
        balls_faced,
        fours,
        sixes
        from batting_performances
        where innings_id = $1 
        and player_id = $2`, [payload.inningsId, payload.strikerId])
    
    const battingAfter = battingAfterResult.rows[0]
    expect(Number(battingAfter.runs)).toBe(Number(battingBefore.runs))
    expect(Number(battingAfter.balls_faced)).toBe(Number(battingBefore.balls_faced))
    expect(Number(battingAfter.fours)).toBe(Number(battingBefore.fours))
    expect(Number(battingAfter.sixes)).toBe(battingBefore.sixes)

    // Restore bowler fixtures for now
    await database.query(`
        update bowling_performances
        set balls_bowled = $3
        where innings_id = $1
        and player_id = $2`, [payload.inningsId, payload.bowlerId, Number(bowlingBefore.balls_bowled)])
  })
afterEach(async () => {
    await cleanupScorecardTest(database)
})
});

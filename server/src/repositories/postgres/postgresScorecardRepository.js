import { MatchFormatRules } from "../../domain/cricket/MatchFormatRules.js";
import ScorecardRepository
  from "../contracts/ScorecardRepository.js";

export default class PostgresScorecardRepository
  extends ScorecardRepository {

  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }


  async findByMatchId(matchId) {
    const query = `
      SELECT
        sc.id,
        sc.match_id,
        sc.created_at,
        sc.updated_at

      FROM scorecards sc

      WHERE sc.match_id = $1;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [matchId]
      );

    return result.rows[0] ?? null;
  }


  async findInningsByScorecardId(scorecardId) {
    const query = `
      SELECT
        i.id,
        i.scorecard_id,
        i.batting_team_id,
        i.innings_number,
        i.total_runs,
        i.wickets,
        i.overs,
        i.extras,

        t.name AS batting_team_name,
        t.short_name AS batting_team_short_name

      FROM innings i

      JOIN teams t
        ON i.batting_team_id = t.id

      WHERE i.scorecard_id = $1

      ORDER BY i.innings_number ASC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [scorecardId]
      );

    return result.rows;
  }


  async findBattingPerformancesByInningsId(inningsId) {
    const query = `
      SELECT
        bp.id,
        bp.innings_id,
        bp.player_id,
        bp.runs,
        bp.balls_faced,
        bp.fours,
        bp.sixes,
        bp.strike_rate,

        p.name AS player_name

      FROM batting_performances bp

      JOIN players p
        ON bp.player_id = p.id

      WHERE bp.innings_id = $1

      ORDER BY bp.runs DESC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [inningsId]
      );

    return result.rows;
  }


  async findBowlingPerformancesByInningsId(inningsId) {
    const query = `
      SELECT
        bwp.id,
        bwp.innings_id,
        bwp.player_id,
        bwp.overs,
        bwp.maidens,
        bwp.runs_conceded,
        bwp.wickets,
        bwp.economy,

        p.name AS player_name

      FROM bowling_performances bwp

      JOIN players p
        ON bwp.player_id = p.id

      WHERE bwp.innings_id = $1

      ORDER BY
        bwp.wickets DESC,
        bwp.runs_conceded ASC;
    `;

    const result =
      await this.databaseClient.query(
        query,
        [inningsId]
      );

    return result.rows;
  }

  async recordBall(eventId, payload) {
  const client =
    await this.databaseClient.connect()

  try {
    await client.query("BEGIN")

    // 1. Insert delivery
       const deliveryResult =
            await client.query(
                `
                INSERT INTO deliveries (
                    event_id,
                    match_id,
                    innings_id,
                    over_number,
                    ball_number,
                    striker_id,
                    non_striker_id,
                    bowler_id,
                    batsman_runs,
                    extra_runs,
                    total_runs,
                    wide_runs,
                    no_ball_runs,
                    bye_runs,
                    leg_bye_runs,
                    penalty_runs,
                    is_four,
                    is_six,
                    is_wicket,
                    wicket_type,
                    dismissed_player_id,
                    fielder_id,
                    is_legal_delivery
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15,
                    $16, $17, $18, $19, $20,
                    $21, $22, $23
                )
                RETURNING *
                `,
                [
                    eventId,
                    payload.matchId,
                    payload.inningsId,
                    payload.overNumber,
                    payload.ballNumber,
                    payload.strikerId,
                    payload.nonStrikerId,
                    payload.bowlerId,

                    payload.runs.batsman,
                    payload.runs.extras,
                    payload.runs.total,

                    payload.extras.wide,
                    payload.extras.noBall,
                    payload.extras.bye,
                    payload.extras.legBye,
                    payload.extras.penalty,

                    payload.boundary.four,
                    payload.boundary.six,

                    payload.wicket.occurred,
                    payload.wicket.type,
                    payload.wicket.dismissedPlayerId,
                    payload.wicket.fielderId,

                    payload.legalDelivery
                ]
            )

        const delivery = deliveryResult.rows[0]

    // 2. Calculate innings increments
    const runsToAdd = payload.runs.total
    const extrasToAdd = payload.runs.extras 
    const wicketsToAdd = payload.wicket.occurred ? 1: 0
    const legalBallsToAdd = payload.legalDelivery ? 1: 0

    // 3. get match format
    const formatResult = await client.query(`
      select s.format
      from matches m
      join series s
      on s.id = m.series_id
      where m.id = $1`, [payload.matchId])

      const format = formatResult.rows[0].format.toUpperCase()

      const rules = MatchFormatRules[format]

      // 4. lock/read current innings
      const inningsResult = await client.query(`
        select * from innings 
        where id = $1 
        for update `, [payload.inningsId])

      const currentInnings = inningsResult.rows[0]

      // 5. validate new legal ball count
      const newLegalBalls = currentInnings.legal_balls + legalBallsToAdd

      if(rules.inningsMaxBalls != null && newLegalBalls > rules.inningsMaxBalls)
      {
        throw new Error("Innings ball limit exceeded")
      }

      // 6. Update Innings
      const updateInningsResult = await client.query(`
        update innings 
        set
        total_runs = total_runs + $1,
        wickets = wickets + $2,
        extras = extras + $3,
        legal_balls = legal_balls + $4,
        updated_at = CURRENT_TIMESTAMP
        where id = $5
        returning *`,
      [runsToAdd, wicketsToAdd, extrasToAdd, legalBallsToAdd, payload.inningsId])

      const updateInnings = updateInningsResult.rows[0]
    // 7. Update batting performance
    const batsmanRunsToAdd = payload.runs.batsman
    const ballsFacedToAdd = payload.legalDelivery ? 1 : 0
    const foursToAdd = payload.boundary.four ? 1 : 0
    const sixesToAdd = payload.boundary.six ? 1 : 0

    // Update the striker
    await client.query(`
      update batting_performances
      set 
      runs = runs + $1,
      balls_faced = balls_faced + $2,
      fours = fours + $3 ,
      sixes = sixes + $4
      where innings_id = $5
      and player_id = $6`,[batsmanRunsToAdd, ballsFacedToAdd, foursToAdd, sixesToAdd,
        payload.inningsId, payload.strikerId])

    // 8. Update bowling performance

    const bowlersBallsToAdd = payload.legalDelivery ? 1 : 0
    const bowlerRunsToAdd = payload.runs.total - payload.extras.bye - payload.extras.legBye
    const bowlerWicketTypes = ["BOWLED", "CAUGHT", "STUMPED", "LBW", "HIT_WICKET"]
    const bowlerWicketsToAdd = payload.wicket.occurred && bowlerWicketTypes.includes(payload.wicket.type) ? 1 : 0

    // Lock Current bowler row

    const bowlingResult = await client.query(`
      select * from bowling_performances
      where innings_id = $1 
      and player_id = $2
      for update `, [payload.inningsId, payload.bowlerId])

    if(bowlingResult.rows.length === 0)
    {
      throw new Error("Bowling performances not found")
    }
    const currentBowling = bowlingResult.rows[0]

    // Calculate new bowler state

    const newBowlerBalls = currentBowling.balls_bowled + bowlersBallsToAdd
    if(rules.bowlerMaxBalls != null && newBowlerBalls > rules.bowlerMaxBalls)
    {
        throw new Error("Bowler ball limit exceeded")
    }

    const newRunsConceded = currentBowling.runs_conceded + bowlerRunsToAdd
    const newWickets = currentBowling.wickets + bowlerWicketsToAdd

    // Derive overs from balls_bowled

    const completedOvers = Math.floor(newBowlerBalls/rules.ballsPerOver)
    const ballsInOver = newBowlerBalls % rules.ballsPerOver
    const displayOvers = `${completedOvers}.${ballsInOver}`

    // calculate economy
    const economy = newBowlerBalls === 0 ? 0 : (newRunsConceded * rules.ballsPerOver / newBowlerBalls)

    // Persist update bowler state

    const updateBowlingResult = await client.query(`
      update bowling_performances
      set
      balls_bowled = $1,
      runs_conceded = $2,
      wickets = $3,
      overs = $4,
      economy = $5 
      where innings_id = $6
      and player_id = $7
      returning *`, [newBowlerBalls, newRunsConceded, newWickets, displayOvers, economy,
        payload.inningsId, payload.bowlerId])
    
    const updatedBowling = updateBowlingResult.rows[0] 
    
    // 9. Handle wicket if present

    if(payload.wicket.occurred && payload.wicket.dismissedPlayerId)
    {
      const bowlerCredited = bowlerWicketTypes.includes(payload.wicket.type)
      await client.query(`
        update batting_performances
        set
        is_out = true,
        dismissal_type = $1,
        dismissal_by_bowler_id = $2,
        fielder_id = $3,
        dismissal_text = $4
        where innings_id = $5
        and player_id = $6`, [payload.wicket.type, bowlerCredited ? payload.bowlerId : null, payload.wicket.fielderId, payload.wicket.dismissalText, payload.inningsId, payload.wicket.dismissedPlayerId])
    }
    // 10. Update scorecard/current state
    // 7. Insert commentary event
    // 8. Possibly add over summary / milestone

    await client.query("COMMIT")
    return updateInnings


  } catch (error) {

    await client.query("ROLLBACK")

    throw error

  } finally {

    client.release()
  }
}
}




// Repository Pattern:
// PostgreSQL-specific persistence logic is isolated here.

// SRP:
// This repository handles Scorecard-related data retrieval only.

// Constructor DI:
// databaseClient is injected.

// DIP:
// ScorecardService depends on ScorecardRepository abstraction.

// LSP:
// Another ScorecardRepository implementation can replace this one.

// Consistency
// Atomicity
// Testability
// Transaction Script
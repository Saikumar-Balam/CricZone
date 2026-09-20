import { MatchFormatRules } from "../../domain/cricket/MatchFormatRules.js";

import { SuperOverRules } from "../../domain/SuperOverRules.js";

import ScorecardRepository from "../contracts/ScorecardRepository.js";

export default class PostgresScorecardRepository extends ScorecardRepository {
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

    const result = await this.databaseClient.query(query, [matchId]);

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

        i.legal_balls,
        i.innings_type,
        i.super_over_number,

        t.name AS batting_team_name,
        t.short_name
          AS batting_team_short_name

      FROM innings i

      JOIN teams t
        ON i.batting_team_id = t.id

      WHERE i.scorecard_id = $1

      ORDER BY
        i.innings_number ASC;
    `;

    const result = await this.databaseClient.query(query, [scorecardId]);

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

      ORDER BY
        bp.runs DESC;
    `;

    const result = await this.databaseClient.query(query, [inningsId]);

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
        bwp.balls_bowled,

        p.name AS player_name

      FROM bowling_performances bwp

      JOIN players p
        ON bwp.player_id = p.id

      WHERE bwp.innings_id = $1

      ORDER BY
        bwp.wickets DESC,
        bwp.runs_conceded ASC;
    `;

    const result = await this.databaseClient.query(query, [inningsId]);

    return result.rows;
  }

  async recordBall(eventId, payload) {
    const client = await this.databaseClient.getClient();

    try {
      await client.query("BEGIN");
      // Idempotency or duplicate eventId check
      const duplicateCheck = await client.query(`
        select id from deliveries
        where event_id = $1
        limit 1`, [eventId])
    
      if(duplicateCheck.rows.length > 0)
      {
        await client.query("ROLLBACK")
        return {
          duplicate: true,
          eventId
        }
      }

      // 1. Insert delivery

      const deliveryResult = await client.query(
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

          payload.legalDelivery,
        ],
      );

      const delivery = deliveryResult.rows[0];

      // 2. Calculate innings increments

      const runsToAdd = payload.runs.total;

      const extrasToAdd = payload.runs.extras;

      const wicketsToAdd = payload.wicket.occurred ? 1 : 0;

      const legalBallsToAdd = payload.legalDelivery ? 1 : 0;

      // 3. Get match format

      const formatResult = await client.query(
        `
          SELECT
            s.format

          FROM matches m

          JOIN series s
            ON s.id = m.series_id

          WHERE m.id = $1
          `,
        [payload.matchId],
      );

      if (formatResult.rows.length === 0) {
        throw new Error("Match format not found");
      }

      const format = formatResult.rows[0].format.toUpperCase();

      // 4. Lock/read current innings

      const inningsResult = await client.query(
        `
          SELECT *
          FROM innings

          WHERE id = $1

          FOR UPDATE
          `,
        [payload.inningsId],
      );

      if (inningsResult.rows.length === 0) {
        throw new Error("Innings not found");
      }

      const currentInnings = inningsResult.rows[0];

      // 5. Select innings/bowling rules

      let inningsRules;
      let bowlingRules;

      if (currentInnings.innings_type === "SUPER_OVER") {
        inningsRules = {
          inningsMaxBalls: SuperOverRules.ballsPerInnings,

          wicketsToEndInnings: SuperOverRules.wicketsToEndInnings,

          ballsPerOver: 6,
        };

        bowlingRules = {
          bowlerMaxBalls: SuperOverRules.ballsPerInnings,

          ballsPerOver: 6,
        };
      } else {
        inningsRules = MatchFormatRules[format];

        bowlingRules = MatchFormatRules[format];
      }

      if (!inningsRules) {
        throw new Error(`Unsupported match format: ${format}`);
      }

      // 6. Validate innings state

      const newLegalBalls = currentInnings.legal_balls + legalBallsToAdd;

      const newInningsWickets = currentInnings.wickets + wicketsToAdd;

      const inningsEndedByWickets = inningsRules.wicketsToEndInnings != null &&newInningsWickets >= inningsRules.wicketsToEndInnings;
        

      if (
        inningsRules.inningsMaxBalls != null &&
        newLegalBalls > inningsRules.inningsMaxBalls
      ) {
        throw new Error("Innings ball limit exceeded");
      }

      // 7. Update innings

      const updateInningsResult = await client.query(
        `
          UPDATE innings

          SET
            total_runs =
              total_runs + $1,

            wickets =
              wickets + $2,

            extras =
              extras + $3,

            legal_balls =
              legal_balls + $4,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $5

          RETURNING *
          `,
        [
          runsToAdd,
          wicketsToAdd,
          extrasToAdd,
          legalBallsToAdd,
          payload.inningsId,
        ],
      );

      const updatedInnings = updateInningsResult.rows[0];

      // 8. Update batting performance

      const batsmanRunsToAdd = payload.runs.batsman;

      const ballsFacedToAdd = payload.legalDelivery ? 1 : 0;

      const foursToAdd = payload.boundary.four ? 1 : 0;

      const sixesToAdd = payload.boundary.six ? 1 : 0;

      await client.query(
        `
        UPDATE batting_performances

        SET
          runs =
            runs + $1,

          balls_faced =
            balls_faced + $2,

          fours =
            fours + $3,

          sixes =
            sixes + $4

        WHERE innings_id = $5
          AND player_id = $6
        `,
        [
          batsmanRunsToAdd,
          ballsFacedToAdd,
          foursToAdd,
          sixesToAdd,

          payload.inningsId,
          payload.strikerId,
        ],
      );

      // 9. Update bowling performance

      const bowlerBallsToAdd = payload.legalDelivery ? 1 : 0;

      const bowlerRunsToAdd =
        payload.runs.total - payload.extras.bye - payload.extras.legBye;

      const bowlerWicketTypes = [
        "BOWLED",
        "CAUGHT",
        "STUMPED",
        "LBW",
        "HIT_WICKET",
      ];

      const bowlerWicketsToAdd =
        payload.wicket.occurred &&
        bowlerWicketTypes.includes(payload.wicket.type)
          ? 1
          : 0;

      // Lock current bowler row

      const bowlingResult = await client.query(
        `
          SELECT *
          FROM bowling_performances

          WHERE innings_id = $1
            AND player_id = $2

          FOR UPDATE
          `,
        [payload.inningsId, payload.bowlerId],
      );

      if (bowlingResult.rows.length === 0) {
        throw new Error("Bowling performance not found");
      }

      const currentBowling = bowlingResult.rows[0];

      // Calculate new bowler state

      const newBowlerBalls = currentBowling.balls_bowled + bowlerBallsToAdd;

      if (
        bowlingRules.bowlerMaxBalls != null &&
        newBowlerBalls > bowlingRules.bowlerMaxBalls
      ) {
        throw new Error("Bowler ball limit exceeded");
      }

      const newRunsConceded = currentBowling.runs_conceded + bowlerRunsToAdd;

      const newBowlerWickets = currentBowling.wickets + bowlerWicketsToAdd;

      // Derive overs

      const completedOvers = Math.floor(
        newBowlerBalls / bowlingRules.ballsPerOver,
      );

      const ballsInOver = newBowlerBalls % bowlingRules.ballsPerOver;

      const displayOvers = `${completedOvers}.${ballsInOver}`;

      // Calculate economy

      const economy =
        newBowlerBalls === 0
          ? 0
          : (newRunsConceded * bowlingRules.ballsPerOver) / newBowlerBalls;

      // Persist bowling state

      const updateBowlingResult = await client.query(
        `
          UPDATE bowling_performances

          SET
            balls_bowled = $1,
            runs_conceded = $2,
            wickets = $3,
            overs = $4,
            economy = $5

          WHERE innings_id = $6
            AND player_id = $7

          RETURNING *
          `,
        [
          newBowlerBalls,
          newRunsConceded,
          newBowlerWickets,
          displayOvers,
          economy,

          payload.inningsId,
          payload.bowlerId,
        ],
      );

      const updatedBowling = updateBowlingResult.rows[0];

      // 10. Handle wicket if present

      if (payload.wicket.occurred && payload.wicket.dismissedPlayerId) {
        const bowlerCredited = bowlerWicketTypes.includes(payload.wicket.type);

        await client.query(
          `
          UPDATE batting_performances

          SET
            is_out = TRUE,

            dismissal_type = $1,

            dismissed_by_bowler_id = $2,

            fielder_id = $3,

            dismissal_text = $4

          WHERE innings_id = $5
            AND player_id = $6
          `,
          [
            payload.wicket.type,

            bowlerCredited ? payload.bowlerId : null,

            payload.wicket.fielderId,

            payload.wicket.dismissalText,

            payload.inningsId,

            payload.wicket.dismissedPlayerId,
          ],
        );
      }

      //  Update current live batting/bowling state

      const currentStateResult = await client.query(
        `
        update innings 
        set
        current_striker_id = $1,
        current_non_striker_id = $2,
        current_bowler_id = $3,
        updated_at = CURRENT_TIMESTAMP
        where id = $4
        returning *`,
        [
          payload.currentState.strikerId,
          payload.currentState.nonStrikerId,
          payload.currentState.bowlerId,
          payload.inningsId,
        ],
      );

      const updatedCurrentState = currentStateResult.rows[0];

      // 11. Update scorecard/current state

      const updatedScorecardResult = await client.query(
        `
          UPDATE scorecards

          SET
            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = (
            SELECT scorecard_id

            FROM innings

            WHERE id = $1
          )

          RETURNING *
          `,
        [payload.inningsId],
      );

      const updatedScorecard = updatedScorecardResult.rows[0];

      // 12. Insert commentary event
      let highlightType = null;
      if (payload.wicket.occurred) {
        highlightType = "WICKET";
      } else if (payload.boundary.six) {
        highlightType = "SIX";
      } else if (payload.boundary.four) {
        highlightType = "FOUR";
      }

      const commentaryResult = await client.query(
        `
          INSERT INTO commentary_events (
      event_id,
      match_id,
      innings_id,
      delivery_id,

      event_type,

      over_number,
      ball_number,

      title,
      text,

      highlight_type,

      metadata
    )

    VALUES (
      $1, $2, $3, $4,
      $5,
      $6, $7,
      $8, $9,
      $10,
      $11
    )

    RETURNING *
    `,
        [
          eventId,
          payload.matchId,
          payload.inningsId,
          delivery.id,
          "BALL",
          payload.overNumber,
          payload.ballNumber,
          payload.commentary?.title ?? null,
          payload.commentary?.text ?? null,
          highlightType,
          JSON.stringify({
            result: {
              batsmanRuns: payload.runs.batsman,
              extraRuns: payload.runs.extras,
              totalRuns: payload.runs.total,
            },
            extras: payload.extras,
            boundary: payload.boundary,
            wicket: payload.wicket,
            strikerId: payload.strikerId,
            nonStrikerId: payload.nonStrikerId,
            bowlerId: payload.bowlerId,
            legalDelivery: payload.legalDelivery,
          }),
        ],
      );

      const commentaryEvent = commentaryResult.rows[0];

      // 13. Possibly add over summary / milestone

      let overSummaryEvent = null;

      const isOverCompleted =
        payload.legalDelivery &&
        updatedInnings.legal_balls % inningsRules.ballsPerOver === 0;

      if (isOverCompleted) {
        const overNumber =
          updatedInnings.legal_balls / inningsRules.ballsPerOver;

        const batterResult = await client.query(
          `
            SELECT
                bp.player_id,
                bp.runs,
                bp.balls_faced,
                bp.fours,
                bp.sixes,
                bp.strike_rate,
                p.name AS player_name

            FROM batting_performances bp

            JOIN players p
                ON p.id = bp.player_id

            WHERE bp.innings_id = $1
              AND bp.player_id IN ($2, $3)
            `,
          [
            payload.inningsId,
            updatedCurrentState.current_striker_id,
            updatedCurrentState.current_non_striker_id,
          ],
        );

        const batters = batterResult.rows;

        const overSummaryResult = await client.query(
          `
            INSERT INTO commentary_events (
                match_id,
                innings_id,
                delivery_id,
                event_type,
                over_number,
                title,
                text,
                highlight_type,
                metadata
            )

            VALUES (
                $1, $2, $3,
                $4, $5,
                $6, $7,
                $8, $9
            )

            RETURNING *
            `,
          [
            payload.matchId,
            payload.inningsId,
            delivery.id,

            "OVER_SUMMARY",

            overNumber,

            `OVER ${overNumber}`,

            null,
            null,

            JSON.stringify({
              score: {
                runs: updatedInnings.total_runs,

                wickets: updatedInnings.wickets,
              },

              batters: batters.map((batter) => ({
                playerId: batter.player_id,

                name: batter.player_name,

                runs: batter.runs,

                balls: batter.balls_faced,

                fours: batter.fours,

                sixes: batter.sixes,

                strikeRate: batter.strike_rate,
              })),

              bowler: {
                playerId: payload.bowlerId,

                ballsBowled: updatedBowling.balls_bowled,

                runsConceded: updatedBowling.runs_conceded,

                wickets: updatedBowling.wickets,

                overs: updatedBowling.overs,

                economy: updatedBowling.economy,
              },
            }),
          ],
        );

        overSummaryEvent = overSummaryResult.rows[0];
      }

      // 14. milestone commentary
      const milestoneEvents = []
      // Batter milestone
      const batterMilestoneResult = await client.query(`
        select 
        bp.player_id,
        bp.runs,
        bp.balls_faced,
        p.name as player_name
        from batting_performances bp
        
        join players p 
        on p.id = bp.player_id
        where bp.innings_id = $1
        and bp.player_id = $2`, [payload.inningsId, payload.strikerId])

      const updatedBatter = batterMilestoneResult.rows[0]

      if(updatedBatter)
      {
        const previousBatterRuns = updatedBatter.runs - payload.runs.batsman
        const batterMilestones = inningsRules.milestones?.batterRuns ?? []

        for(const milestone of batterMilestones)
        {
          const milestoneCrossed = previousBatterRuns < milestone && updatedBatter.runs>=milestone
          if(!milestoneCrossed)
          {
            continue
          }

          const batterMilestoneEventResult = await client.query(`
            insert into commentary_events(
            match_id,
            innings_id,
            delivery_id,
            event_type,
            over_number,
            ball_number,
            title,
            text,
            highlight_type,
            metadata)
            
            values (
            $1, $2, $3,
            $4, 
            $5, $6,
            $7, $8, 
            $9, $10)
            returning *`, [payload.matchId, payload.inningsId, delivery.id, "MILESTONE", payload.overNumber, payload.ballNumber, 
            `${updatedBatter.player_name} ${milestone}`,
            `${updatedBatter.player_name} reaches ${milestone} runs`,"MILESTONE",
            JSON.stringify({
              milestoneType: "BATTER_RUNS",
              format,
              milestone,
              playerId: updatedBatter.player_id,
              playerName: updatedBatter.player_name,
              runs: updatedBatter.runs,
              balls: updatedBatter.balls_faced,
            })
          ])
          milestoneEvents.push(batterMilestoneEventResult.rows[0])
        }
      }
      
      // Team Milestone
      const previousTeamRuns = updatedInnings.total_runs - payload.runs.total 
      const teamMilestones = inningsRules.milestones?.teamRuns ?? []
      for(const milestone of teamMilestones)
      {
        const milestoneCrossed = previousTeamRuns < milestone && updatedInnings.total_runs>=milestone
        if(!milestoneCrossed)  
        {
          continue 
        }
        const teamMilestoneEventResult = await client.query(`
          insert into commentary_events(
          match_id,
          innings_id,
          delivery_id,
          event_type,
          over_number, 
          ball_number,
          title, 
          text,
          highlight_type,
          metadata)
          values (
          $1, $2, $3,
          $4, 
          $5, $6, 
          $7, $8,
          $9, $10)
          returning *`, [payload.matchId, payload.inningsId, delivery.id, "MILESTONE", payload.overNumber, payload.ballNumber, 
            `TEAM ${milestone}`,
            `Team reaches ${milestone} runs`,
            "MILESTONE",
            JSON.stringify({
              milestoneType: "TEAM_RUNS",
              format,
              milestone,
              runs: updatedInnings.total_runs,
              wickets: updatedInnings.wickets,

            })
          ])
          milestoneEvents.push(teamMilestoneEventResult.rows[0])

      }

      // Innings Completion Handling
      const inningsEndedByBalls = inningsRules.inningsMaxBalls != null && newLegalBalls >= inningsRules.inningsMaxBalls
      const inningsEndedByChase = currentInnings.target_runs !=null && updatedInnings.total_runs  >= currentInnings.target_runs

      const inningsCompleted = inningsEndedByWickets || inningsEndedByBalls || inningsEndedByChase

      let completionReason = null
      if(inningsEndedByChase)
      {
        completionReason = "TARGET_CHASED"
      }
      else if(inningsEndedByWickets)
      {
        completionReason = currentInnings.innings_type === "SUPER_OVER" ? "SUPER_OVER_WICKETS" : "ALL_OUT"
      }
      else if(inningsEndedByBalls)
      {
        completionReason = currentInnings.innings_type === "SUPER_OVER" ? "SUPER_OVER_BALL_LIMIT" : "BALL_LIMIT_REACHED"
      }

      let completedInnings = null

      if(inningsCompleted)
      {
        const completedInningsResult = await client.query(`
          update innings
          set
          status = 'COMPLETED',
          completion_reason = $1,
          completed_at = current_timestamp,
          updated_at = current_timestamp
          where id = $2
          returning *`, [completionReason, payload.inningsId])
          completedInnings = completedInningsResult.rows[0]
      }

      let inningsEndEvent = null
      if(inningsCompleted)
      {
        const inningsEndResult = await client.query(`
          insert into commentary_events (
          match_id,
          innings_id,
          delivery_id,
          event_type,
          over_number, 
          ball_number,
          title,
          text,
          highlight_type,
          metadata)
          values (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8,
          $9, $10)
          returning *`, [payload.matchId, payload.inningsId, delivery.id, "INNINGS_END", payload.overNumber, payload.ballNumber, "INNINGS COMPLETE", 
            `Innings completed: ${completionReason}`,
            null, 
            JSON.stringify({
              completionReason,
              runs: updatedInnings.total_runs,
              wickets: updatedInnings.wickets,
              legalBalls: updatedInnings.legal_balls,
              inningsType: currentInnings.innings_type,
              superOverNumber: currentInnings.super_over_number
            })
          ])
          inningsEndEvent = inningsEndResult.rows[0]
      }


      await client.query("COMMIT");

      return {
        delivery,
        updatedInnings,
        updatedBowling,
        updatedScorecard,
        inningsEndedByWickets,
        commentaryEvent,
        overSummaryEvent,
        milestoneEvents,

        inningsCompleted,
        completionReason,
        completedInnings,
        inningsEndEvent
      };
    } catch (error) {
      await client.query("ROLLBACK");

      throw error;
    } finally {
      client.release();
    }
  }
}

// Repository Pattern
// PostgreSQL-specific persistence logic is isolated here.

// SRP
// Repository handles Scorecard-related persistence.

// Constructor DI
// databaseClient is injected.

// DIP
// Higher-level service depends on ScorecardRepository abstraction.

// LSP
// Another ScorecardRepository implementation can replace this one.

// Consistency
// Atomicity
// Testability
// Transaction Script

// Repository Pattern — transaction persistence stays in repository.
// Atomicity — all ball-related changes commit or rollback together.
// DI/DIP — database client is injected.
// Resource Safety — connection is always released in finally.
// Concurrency Control — FOR UPDATE protects mutable innings/bowling state.
// Idempotency — duplicate eventId processing is prevented.
// Transaction Script — one business operation coordinates one atomic transaction.

import StatisticsRepository
  from "../contracts/StatisticsRepository.js";

export default class PostgresStatisticsRepository
  extends StatisticsRepository {

  constructor(databaseClient) {
    super();

    this.databaseClient = databaseClient;
  }


  // ==================================================
  // PLAYER STATISTICS
  // ==================================================

  async findPlayerStatistics(playerId) {

    // --------------------------------------------------
    // BATTING BY FORMAT
    // --------------------------------------------------

    const battingByFormatQuery = `
      SELECT
        COALESCE(
          mf.code,
          m.format
        ) AS format,

        COUNT(*) AS innings_batted,

        COUNT(
          CASE
            WHEN bp.is_out = TRUE
            THEN 1
          END
        ) AS dismissals,

        COALESCE(
          SUM(bp.runs),
          0
        ) AS total_runs,

        COALESCE(
          SUM(bp.balls_faced),
          0
        ) AS balls_faced,

        COALESCE(
          SUM(bp.fours),
          0
        ) AS fours,

        COALESCE(
          SUM(bp.sixes),
          0
        ) AS sixes,

        COALESCE(
          MAX(bp.runs),
          0
        ) AS highest_score,

        CASE
          WHEN SUM(bp.balls_faced) > 0
          THEN ROUND(
            (
              SUM(bp.runs)::NUMERIC
              /
              SUM(bp.balls_faced)
            ) * 100,
            2
          )
          ELSE 0
        END AS strike_rate,

        CASE
          WHEN COUNT(
            CASE
              WHEN bp.is_out = TRUE
              THEN 1
            END
          ) > 0
          THEN ROUND(
            SUM(bp.runs)::NUMERIC
            /
            COUNT(
              CASE
                WHEN bp.is_out = TRUE
                THEN 1
              END
            ),
            2
          )
          ELSE NULL
        END AS batting_average

      FROM batting_performances bp

      JOIN innings i
        ON bp.innings_id = i.id

      JOIN scorecards sc
        ON i.scorecard_id = sc.id

      JOIN matches m
        ON sc.match_id = m.id

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      WHERE bp.player_id = $1

      GROUP BY
        COALESCE(
          mf.code,
          m.format
        )

      ORDER BY format;
    `;


    // --------------------------------------------------
    // BOWLING BY FORMAT
    // Uses balls_bowled for correct calculations.
    // --------------------------------------------------

    const bowlingByFormatQuery = `
      SELECT
        COALESCE(
          mf.code,
          m.format
        ) AS format,

        COUNT(*) AS innings_bowled,

        COALESCE(
          SUM(bwp.wickets),
          0
        ) AS total_wickets,

        COALESCE(
          SUM(bwp.runs_conceded),
          0
        ) AS runs_conceded,

        COALESCE(
          SUM(bwp.maidens),
          0
        ) AS maidens,

        COALESCE(
          SUM(bwp.balls_bowled),
          0
        ) AS balls_bowled,

        CASE
          WHEN SUM(bwp.wickets) > 0
          THEN ROUND(
            SUM(bwp.runs_conceded)::NUMERIC
            /
            SUM(bwp.wickets),
            2
          )
          ELSE NULL
        END AS bowling_average,

        CASE
          WHEN SUM(bwp.balls_bowled) > 0
          THEN ROUND(
            (
              SUM(bwp.runs_conceded)::NUMERIC
              * 6
            )
            /
            SUM(bwp.balls_bowled),
            2
          )
          ELSE NULL
        END AS economy

      FROM bowling_performances bwp

      JOIN innings i
        ON bwp.innings_id = i.id

      JOIN scorecards sc
        ON i.scorecard_id = sc.id

      JOIN matches m
        ON sc.match_id = m.id

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      WHERE bwp.player_id = $1

      GROUP BY
        COALESCE(
          mf.code,
          m.format
        )

      ORDER BY format;
    `;


    // --------------------------------------------------
    // BEST BOWLING BY FORMAT
    // 6/55 > 5/10
    // 5/27 > 5/40
    // --------------------------------------------------

    const bestBowlingByFormatQuery = `
      SELECT DISTINCT ON (
        COALESCE(
          mf.code,
          m.format
        )
      )

        COALESCE(
          mf.code,
          m.format
        ) AS format,

        bwp.wickets
          AS best_wickets,

        bwp.runs_conceded
          AS best_runs_conceded

      FROM bowling_performances bwp

      JOIN innings i
        ON bwp.innings_id = i.id

      JOIN scorecards sc
        ON i.scorecard_id = sc.id

      JOIN matches m
        ON sc.match_id = m.id

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      WHERE bwp.player_id = $1

      ORDER BY
        COALESCE(
          mf.code,
          m.format
        ),
        bwp.wickets DESC,
        bwp.runs_conceded ASC;
    `;


    // --------------------------------------------------
    // BATTING BY COMPETITION
    // --------------------------------------------------

    const battingByCompetitionQuery = `
      SELECT
        s.id AS series_id,
        s.name AS competition_name,

        COALESCE(
          mf.code,
          m.format
        ) AS format,

        COUNT(
          DISTINCT m.id
        ) AS matches,

        COUNT(*) AS innings_batted,

        COUNT(
          CASE
            WHEN bp.is_out = TRUE
            THEN 1
          END
        ) AS dismissals,

        COALESCE(
          SUM(bp.runs),
          0
        ) AS total_runs,

        COALESCE(
          SUM(bp.balls_faced),
          0
        ) AS balls_faced,

        COALESCE(
          SUM(bp.fours),
          0
        ) AS fours,

        COALESCE(
          SUM(bp.sixes),
          0
        ) AS sixes,

        COALESCE(
          MAX(bp.runs),
          0
        ) AS highest_score,

        CASE
          WHEN SUM(bp.balls_faced) > 0
          THEN ROUND(
            (
              SUM(bp.runs)::NUMERIC
              /
              SUM(bp.balls_faced)
            ) * 100,
            2
          )
          ELSE 0
        END AS strike_rate,

        CASE
          WHEN COUNT(
            CASE
              WHEN bp.is_out = TRUE
              THEN 1
            END
          ) > 0
          THEN ROUND(
            SUM(bp.runs)::NUMERIC
            /
            COUNT(
              CASE
                WHEN bp.is_out = TRUE
                THEN 1
              END
            ),
            2
          )
          ELSE NULL
        END AS batting_average

      FROM batting_performances bp

      JOIN innings i
        ON bp.innings_id = i.id

      JOIN scorecards sc
        ON i.scorecard_id = sc.id

      JOIN matches m
        ON sc.match_id = m.id

      JOIN series s
        ON m.series_id = s.id

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      WHERE bp.player_id = $1

      GROUP BY
        s.id,
        s.name,
        COALESCE(
          mf.code,
          m.format
        )

      ORDER BY
        s.name,
        format;
    `;


    // --------------------------------------------------
    // BOWLING BY COMPETITION
    // --------------------------------------------------

    const bowlingByCompetitionQuery = `
      SELECT
        s.id AS series_id,
        s.name AS competition_name,

        COALESCE(
          mf.code,
          m.format
        ) AS format,

        COUNT(
          DISTINCT m.id
        ) AS matches,

        COUNT(*) AS innings_bowled,

        COALESCE(
          SUM(bwp.wickets),
          0
        ) AS total_wickets,

        COALESCE(
          SUM(bwp.runs_conceded),
          0
        ) AS runs_conceded,

        COALESCE(
          SUM(bwp.maidens),
          0
        ) AS maidens,

        COALESCE(
          SUM(bwp.balls_bowled),
          0
        ) AS balls_bowled,

        CASE
          WHEN SUM(bwp.wickets) > 0
          THEN ROUND(
            SUM(bwp.runs_conceded)::NUMERIC
            /
            SUM(bwp.wickets),
            2
          )
          ELSE NULL
        END AS bowling_average,

        CASE
          WHEN SUM(bwp.balls_bowled) > 0
          THEN ROUND(
            (
              SUM(bwp.runs_conceded)::NUMERIC
              * 6
            )
            /
            SUM(bwp.balls_bowled),
            2
          )
          ELSE NULL
        END AS economy

      FROM bowling_performances bwp

      JOIN innings i
        ON bwp.innings_id = i.id

      JOIN scorecards sc
        ON i.scorecard_id = sc.id

      JOIN matches m
        ON sc.match_id = m.id

      JOIN series s
        ON m.series_id = s.id

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      WHERE bwp.player_id = $1

      GROUP BY
        s.id,
        s.name,
        COALESCE(
          mf.code,
          m.format
        )

      ORDER BY
        s.name,
        format;
    `;


    // --------------------------------------------------
    // BEST BOWLING BY COMPETITION
    // --------------------------------------------------

    const bestBowlingByCompetitionQuery = `
      SELECT DISTINCT ON (
        s.id,
        COALESCE(
          mf.code,
          m.format
        )
      )

        s.id AS series_id,
        s.name AS competition_name,

        COALESCE(
          mf.code,
          m.format
        ) AS format,

        bwp.wickets
          AS best_wickets,

        bwp.runs_conceded
          AS best_runs_conceded

      FROM bowling_performances bwp

      JOIN innings i
        ON bwp.innings_id = i.id

      JOIN scorecards sc
        ON i.scorecard_id = sc.id

      JOIN matches m
        ON sc.match_id = m.id

      JOIN series s
        ON m.series_id = s.id

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      WHERE bwp.player_id = $1

      ORDER BY
        s.id,
        COALESCE(
          mf.code,
          m.format
        ),
        bwp.wickets DESC,
        bwp.runs_conceded ASC;
    `;


    const [
      battingResult,
      bowlingResult,
      bestBowlingResult,
      battingCompetitionResult,
      bowlingCompetitionResult,
      bestBowlingCompetitionResult
    ] = await Promise.all([

      this.databaseClient.query(
        battingByFormatQuery,
        [playerId]
      ),

      this.databaseClient.query(
        bowlingByFormatQuery,
        [playerId]
      ),

      this.databaseClient.query(
        bestBowlingByFormatQuery,
        [playerId]
      ),

      this.databaseClient.query(
        battingByCompetitionQuery,
        [playerId]
      ),

      this.databaseClient.query(
        bowlingByCompetitionQuery,
        [playerId]
      ),

      this.databaseClient.query(
        bestBowlingByCompetitionQuery,
        [playerId]
      )
    ]);


    // ==================================================
    // FORMAT-WISE PLAYER RESULT
    // ==================================================

    const formatMap = new Map();


    for (const stat of battingResult.rows) {
      formatMap.set(
        stat.format,
        {
          format: stat.format,

          batting: {
            inningsBatted:
              Number(stat.innings_batted),

            dismissals:
              Number(stat.dismissals),

            notOuts:
              Number(stat.innings_batted)
              - Number(stat.dismissals),

            totalRuns:
              Number(stat.total_runs),

            ballsFaced:
              Number(stat.balls_faced),

            fours:
              Number(stat.fours),

            sixes:
              Number(stat.sixes),

            highestScore:
              Number(stat.highest_score),

            strikeRate:
              Number(stat.strike_rate),

            battingAverage:
              stat.batting_average !== null
                ? Number(stat.batting_average)
                : null
          },

          bowling: null
        }
      );
    }


    for (const stat of bowlingResult.rows) {

      if (!formatMap.has(stat.format)) {
        formatMap.set(
          stat.format,
          {
            format: stat.format,
            batting: null,
            bowling: null
          }
        );
      }

      const ballsBowled =
        Number(stat.balls_bowled);

      formatMap.get(stat.format).bowling = {
        inningsBowled:
          Number(stat.innings_bowled),

        totalWickets:
          Number(stat.total_wickets),

        runsConceded:
          Number(stat.runs_conceded),

        maidens:
          Number(stat.maidens),

        ballsBowled,

        oversBowled:
          this.formatOvers(ballsBowled),

        bowlingAverage:
          stat.bowling_average !== null
            ? Number(stat.bowling_average)
            : null,

        economy:
          stat.economy !== null
            ? Number(stat.economy)
            : null,

        bestBowling: null
      };
    }


    for (const stat of bestBowlingResult.rows) {

      if (!formatMap.has(stat.format)) {
        formatMap.set(
          stat.format,
          {
            format: stat.format,
            batting: null,
            bowling: {}
          }
        );
      }

      const formatStatistics =
        formatMap.get(stat.format);

      if (!formatStatistics.bowling) {
        formatStatistics.bowling = {};
      }

      formatStatistics.bowling.bestBowling = {
        wickets:
          Number(stat.best_wickets),

        runsConceded:
          Number(stat.best_runs_conceded),

        display:
          `${stat.best_wickets}/${stat.best_runs_conceded}`
      };
    }


    // ==================================================
    // COMPETITION-WISE PLAYER RESULT
    // ==================================================

    const competitionMap = new Map();


    for (const stat of battingCompetitionResult.rows) {

      const key =
        `${stat.series_id}:${stat.format}`;

      competitionMap.set(
        key,
        {
          seriesId:
            stat.series_id,

          competitionName:
            stat.competition_name,

          format:
            stat.format,

          batting: {
            matches:
              Number(stat.matches),

            inningsBatted:
              Number(stat.innings_batted),

            dismissals:
              Number(stat.dismissals),

            notOuts:
              Number(stat.innings_batted)
              - Number(stat.dismissals),

            totalRuns:
              Number(stat.total_runs),

            ballsFaced:
              Number(stat.balls_faced),

            fours:
              Number(stat.fours),

            sixes:
              Number(stat.sixes),

            highestScore:
              Number(stat.highest_score),

            strikeRate:
              Number(stat.strike_rate),

            battingAverage:
              stat.batting_average !== null
                ? Number(stat.batting_average)
                : null
          },

          bowling: null
        }
      );
    }


    for (const stat of bowlingCompetitionResult.rows) {

      const key =
        `${stat.series_id}:${stat.format}`;

      if (!competitionMap.has(key)) {
        competitionMap.set(
          key,
          {
            seriesId:
              stat.series_id,

            competitionName:
              stat.competition_name,

            format:
              stat.format,

            batting: null,
            bowling: null
          }
        );
      }

      const ballsBowled =
        Number(stat.balls_bowled);

      competitionMap.get(key).bowling = {
        matches:
          Number(stat.matches),

        inningsBowled:
          Number(stat.innings_bowled),

        totalWickets:
          Number(stat.total_wickets),

        runsConceded:
          Number(stat.runs_conceded),

        maidens:
          Number(stat.maidens),

        ballsBowled,

        oversBowled:
          this.formatOvers(ballsBowled),

        bowlingAverage:
          stat.bowling_average !== null
            ? Number(stat.bowling_average)
            : null,

        economy:
          stat.economy !== null
            ? Number(stat.economy)
            : null,

        bestBowling: null
      };
    }


    for (const stat of bestBowlingCompetitionResult.rows) {

      const key =
        `${stat.series_id}:${stat.format}`;

      if (!competitionMap.has(key)) {
        competitionMap.set(
          key,
          {
            seriesId:
              stat.series_id,

            competitionName:
              stat.competition_name,

            format:
              stat.format,

            batting: null,
            bowling: {}
          }
        );
      }

      const competitionStatistics =
        competitionMap.get(key);

      if (!competitionStatistics.bowling) {
        competitionStatistics.bowling = {};
      }

      competitionStatistics.bowling.bestBowling = {
        wickets:
          Number(stat.best_wickets),

        runsConceded:
          Number(stat.best_runs_conceded),

        display:
          `${stat.best_wickets}/${stat.best_runs_conceded}`
      };
    }


    return {
      formatStatistics:
        Array.from(formatMap.values()),

      competitionStatistics:
        Array.from(competitionMap.values())
    };
  }



  // ==================================================
  // TEAM STATISTICS
  // ==================================================

  async findTeamStatistics(teamId) {

    const formatStatsQuery = `
      SELECT
        COALESCE(
          mf.code,
          m.format
        ) AS format,

        COUNT(
          DISTINCT m.id
        ) AS matches_played,

        COUNT(
          DISTINCT CASE
            WHEN m.status = 'COMPLETED'
            THEN m.id
          END
        ) AS completed_matches,

        COALESCE(
          SUM(
            CASE
              WHEN i.batting_team_id = $1
              THEN i.total_runs
              ELSE 0
            END
          ),
          0
        ) AS total_runs,

        COALESCE(
          SUM(
            CASE
              WHEN i.batting_team_id <> $1
              THEN i.wickets
              ELSE 0
            END
          ),
          0
        ) AS wickets_taken

      FROM matches m

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      LEFT JOIN scorecards sc
        ON sc.match_id = m.id

      LEFT JOIN innings i
        ON i.scorecard_id = sc.id

      WHERE
        m.team1_id = $1
        OR m.team2_id = $1

      GROUP BY
        COALESCE(
          mf.code,
          m.format
        )

      ORDER BY format;
    `;


    const competitionStatsQuery = `
      SELECT
        s.id AS series_id,
        s.name AS competition_name,

        COALESCE(
          mf.code,
          m.format
        ) AS format,

        COUNT(
          DISTINCT m.id
        ) AS matches_played,

        COUNT(
          DISTINCT CASE
            WHEN m.status = 'COMPLETED'
            THEN m.id
          END
        ) AS completed_matches,

        COALESCE(
          SUM(
            CASE
              WHEN i.batting_team_id = $1
              THEN i.total_runs
              ELSE 0
            END
          ),
          0
        ) AS total_runs,

        COALESCE(
          SUM(
            CASE
              WHEN i.batting_team_id <> $1
              THEN i.wickets
              ELSE 0
            END
          ),
          0
        ) AS wickets_taken

      FROM matches m

      JOIN series s
        ON m.series_id = s.id

      LEFT JOIN match_formats mf
        ON m.format_id = mf.id

      LEFT JOIN scorecards sc
        ON sc.match_id = m.id

      LEFT JOIN innings i
        ON i.scorecard_id = sc.id

      WHERE
        m.team1_id = $1
        OR m.team2_id = $1

      GROUP BY
        s.id,
        s.name,
        COALESCE(
          mf.code,
          m.format
        )

      ORDER BY
        s.name,
        format;
    `;


    const [
      formatResult,
      competitionResult
    ] = await Promise.all([

      this.databaseClient.query(
        formatStatsQuery,
        [teamId]
      ),

      this.databaseClient.query(
        competitionStatsQuery,
        [teamId]
      )
    ]);


    return {
      formatStatistics:
        formatResult.rows.map(
          (stat) => ({
            format:
              stat.format,

            matchesPlayed:
              Number(stat.matches_played),

            completedMatches:
              Number(stat.completed_matches),

            totalRuns:
              Number(stat.total_runs),

            wicketsTaken:
              Number(stat.wickets_taken)
          })
        ),

      competitionStatistics:
        competitionResult.rows.map(
          (stat) => ({
            seriesId:
              stat.series_id,

            competitionName:
              stat.competition_name,

            format:
              stat.format,

            matchesPlayed:
              Number(stat.matches_played),

            completedMatches:
              Number(stat.completed_matches),

            totalRuns:
              Number(stat.total_runs),

            wicketsTaken:
              Number(stat.wickets_taken)
          })
        )
    };
  }



  // ==================================================
  // SERIES STATISTICS
  // ==================================================

  async findSeriesStatistics(seriesId) {

    const query = `
      SELECT
        s.id AS series_id,
        s.name AS series_name,

        COUNT(
          DISTINCT m.id
        ) AS total_matches,

        COUNT(
          DISTINCT CASE
            WHEN m.status = 'COMPLETED'
            THEN m.id
          END
        ) AS completed_matches,

        COUNT(
          DISTINCT CASE
            WHEN m.status = 'LIVE'
            THEN m.id
          END
        ) AS live_matches,

        COALESCE(
          SUM(i.total_runs),
          0
        ) AS total_runs,

        COALESCE(
          SUM(i.wickets),
          0
        ) AS total_wickets

      FROM series s

      LEFT JOIN matches m
        ON m.series_id = s.id

      LEFT JOIN scorecards sc
        ON sc.match_id = m.id

      LEFT JOIN innings i
        ON i.scorecard_id = sc.id

      WHERE s.id = $1

      GROUP BY
        s.id,
        s.name;
    `;


    const result =
      await this.databaseClient.query(
        query,
        [seriesId]
      );


    const statistics =
      result.rows[0];


    if (!statistics) {
      return null;
    }


    return {
      seriesId:
        statistics.series_id,

      seriesName:
        statistics.series_name,

      totalMatches:
        Number(statistics.total_matches),

      completedMatches:
        Number(statistics.completed_matches),

      liveMatches:
        Number(statistics.live_matches),

      totalRuns:
        Number(statistics.total_runs),

      totalWickets:
        Number(statistics.total_wickets)
    };
  }



  // ==================================================
  // HELPER
  //
  // 64 balls → "10.4"
  // 60 balls → "10.0"
  // ==================================================

  formatOvers(totalBalls) {
    const balls =
      Number(totalBalls);

    const completedOvers =
      Math.floor(balls / 6);

    const remainingBalls =
      balls % 6;

    return `${completedOvers}.${remainingBalls}`;
  }
}


// Repository Pattern:
// Aggregate PostgreSQL statistics queries live here.

// SRP:
// Responsible only for derived Statistics read models.

// Constructor DI:
// databaseClient is injected.

// DIP:
// StatisticsService depends on StatisticsRepository.

// OCP:
// Format handling is data-driven through match_formats.

// LSP:
// Another StatisticsRepository implementation can
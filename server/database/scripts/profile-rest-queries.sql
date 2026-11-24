
\set ON_ERROR_STOP on
\timing on

SELECT
  current_database() AS database_name,
  current_setting('server_version') AS postgres_version,
  current_setting('max_connections') AS max_connections;

SELECT
  'matches' AS table_name,
  COUNT(*) AS row_count
FROM matches
UNION ALL
SELECT 'scorecards', COUNT(*) FROM scorecards
UNION ALL
SELECT 'innings', COUNT(*) FROM innings
UNION ALL
SELECT 'batting_performances', COUNT(*) FROM batting_performances
UNION ALL
SELECT 'bowling_performances', COUNT(*) FROM bowling_performances;

SELECT id AS scorecard_id
FROM scorecards
WHERE match_id = 1
\gset

SELECT id AS inning_id
FROM innings
WHERE scorecard_id = :scorecard_id
ORDER BY innings_number
LIMIT 1
\gset

ANALYZE matches;
ANALYZE scorecards;
ANALYZE innings;
ANALYZE batting_performances;
ANALYZE bowling_performances;
ANALYZE cache_invalidation_outbox;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  m.id,
  m.status,
  m.start_time,
  s.name AS series_name,
  v.name AS venue_name,
  t1.name AS team1_name,
  t2.name AS team2_name
FROM matches m
JOIN series s ON s.id = m.series_id
JOIN venues v ON v.id = m.venue_id
JOIN teams t1 ON t1.id = m.team1_id
JOIN teams t2 ON t2.id = m.team2_id
ORDER BY m.start_time DESC;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT EXISTS (
  SELECT 1
  FROM cache_invalidation_outbox
  WHERE match_id = 1
    AND status <> 'COMPLETED'
) AS has_pending;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  id,
  match_id,
  created_at,
  updated_at
FROM scorecards
WHERE match_id = 1;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  i.*,
  t.name AS batting_team_name,
  t.short_name AS batting_team_short_name
FROM innings i
JOIN teams t ON i.batting_team_id = t.id
WHERE i.scorecard_id = :scorecard_id
ORDER BY i.innings_number ASC;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
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
JOIN players p ON bp.player_id = p.id
WHERE bp.innings_id = :inning_id
ORDER BY bp.runs DESC;

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
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
JOIN players p ON bwp.player_id = p.id
WHERE bwp.innings_id = :inning_id
ORDER BY bwp.wickets DESC, bwp.runs_conceded ASC;

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'matches',
    'scorecards',
    'innings',
    'batting_performances',
    'bowling_performances',
    'cache_invalidation_outbox'
  )
ORDER BY tablename, indexname;

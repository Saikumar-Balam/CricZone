BEGIN;

TRUNCATE TABLE
  news_matches,
  news_series,
  news_teams,
  news_players,
  news,
  rankings,
  bowling_performances,
  batting_performances,
  innings,
  scorecards,
  matches,
  players,
  venues,
  series,
  teams
RESTART IDENTITY CASCADE;

INSERT INTO teams (name, short_name, country)
VALUES
  ('India', 'IND', 'India'),
  ('Australia', 'AUS', 'Australia'),
  ('England', 'ENG', 'England'),
  ('New Zealand', 'NZ', 'New Zealand');

  INSERT INTO players (
  team_id,
  name,
  country,
  role,
  batting_style,
  bowling_style
)
VALUES
  (1, 'Virat Kohli', 'India', 'BATTER',
   'Right-handed', NULL),

  (1, 'Jasprit Bumrah', 'India', 'BOWLER',
   'Right-handed', 'Right-arm fast'),

  (1, 'Ravindra Jadeja', 'India', 'ALL_ROUNDER',
   'Left-handed', 'Left-arm orthodox'),

  (2, 'Travis Head', 'Australia', 'BATTER',
   'Left-handed', 'Right-arm off break'),

  (2, 'Mitchell Starc', 'Australia', 'BOWLER',
   'Left-handed', 'Left-arm fast'),

  (2, 'Josh Hazlewood', 'Australia', 'BOWLER',
   'Left-handed', 'Right-arm fast'),

  (3, 'Joe Root', 'England', 'BATTER',
   'Right-handed', 'Right-arm off break'),

  (3, 'Ben Stokes', 'England', 'ALL_ROUNDER',
   'Left-handed', 'Right-arm fast medium'),

  (4, 'Kane Williamson', 'New Zealand', 'BATTER',
   'Right-handed', 'Right-arm off break'),

  (4, 'Mitchell Santner', 'New Zealand', 'ALL_ROUNDER',
   'Left-handed', 'Left-arm orthodox');

INSERT INTO series (
  name,
  format,
  start_date,
  end_date,
  status
)
VALUES
  ('India vs Australia 2026', 'ODI',
   '2026-08-20', '2026-08-30', 'ONGOING'),

  ('England vs New Zealand 2026', 'TEST',
   '2026-09-05', '2026-09-20', 'UPCOMING');


INSERT INTO venues (name, city, country)
VALUES
  ('Melbourne Cricket Ground', 'Melbourne', 'Australia'),
  ('Wankhede Stadium', 'Mumbai', 'India'),
  ('Lord''s', 'London', 'England');

  INSERT INTO matches (
  series_id,
  venue_id,
  team1_id,
  team2_id,
  format,
  status,
  start_time,
  result
)
VALUES
  (
    1, 1, 1, 2,
    'ODI',
    'COMPLETED',
    '2026-08-24 08:00:00+00',
    'India won by 15 runs'
  ),

  (
    1, 2, 1, 2,
    'ODI',
    'UPCOMING',
    '2026-08-29 08:00:00+00',
    NULL
  ),

  (
    2, 3, 3, 4,
    'TEST',
    'UPCOMING',
    '2026-09-05 10:00:00+00',
    NULL
  );

  INSERT INTO scorecards (match_id)
VALUES (1);

INSERT INTO innings (
  scorecard_id,
  batting_team_id,
  innings_number,
  total_runs,
  wickets,
  overs,
  extras
)
VALUES
  (1, 1, 1, 250, 5, 50.0, 10),
  (1, 2, 2, 235, 7, 50.0, 8);

  INSERT INTO batting_performances (
  innings_id,
  player_id,
  runs,
  balls_faced,
  fours,
  sixes,
  strike_rate
)
VALUES
  (1, 1, 120, 110, 10, 2, 109.09),
  (1, 2, 30, 20, 3, 1, 150.00),
  (1, 3, 90, 85, 6, 2, 105.88);

  INSERT INTO batting_performances (
  innings_id,
  player_id,
  runs,
  balls_faced,
  fours,
  sixes,
  strike_rate
)
VALUES
  (2, 4, 110, 100, 9, 3, 110.00),
  (2, 5, 25, 18, 2, 1, 138.89),
  (2, 6, 92, 87, 7, 2, 105.75);

  INSERT INTO bowling_performances (
  innings_id,
  player_id,
  overs,
  maidens,
  runs_conceded,
  wickets,
  economy
)
VALUES
  -- Australia bowling to India
  (1, 5, 10.0, 1, 48, 3, 4.80),
  (1, 6, 10.0, 0, 52, 2, 5.20),

  -- India bowling to Australia
  (2, 2, 10.0, 2, 42, 4, 4.20),
  (2, 3, 10.0, 0, 55, 3, 5.50);

  INSERT INTO rankings (
  player_id,
  team_id,
  format,
  category,
  position,
  rating
)
VALUES
  (1, NULL, 'ODI', 'BATTER', 1, 910),
  (4, NULL, 'ODI', 'BATTER', 3, 860),
  (2, NULL, 'ODI', 'BOWLER', 1, 895),

  (NULL, 1, 'ODI', 'TEAM', 1, 120),
  (NULL, 2, 'ODI', 'TEAM', 2, 116),
  (NULL, 3, 'TEST', 'TEAM', 3, 108),
  (NULL, 4, 'TEST', 'TEAM', 4, 104);

  INSERT INTO news (
  title,
  content,
  image_url,
  published_at
)
VALUES
  (
    'India defeat Australia in opening ODI',
    'India secured a 15-run victory after a strong batting and bowling performance.',
    NULL,
    NOW()
  ),

  (
    'Virat Kohli stars with 120',
    'Virat Kohli produced a match-winning century against Australia.',
    NULL,
    NOW()
  ),

  (
    'England prepare for New Zealand Test series',
    'England and New Zealand are preparing for their upcoming Test series.',
    NULL,
    NOW()
  );

  INSERT INTO news_players (news_id, player_id)
VALUES
  (2, 1);

INSERT INTO news_teams (news_id, team_id)
VALUES
  (1, 1),
  (1, 2),
  (3, 3),
  (3, 4);

INSERT INTO news_series (news_id, series_id)
VALUES
  (1, 1),
  (2, 1),
  (3, 2);

INSERT INTO news_matches (news_id, match_id)
VALUES
  (1, 1),
  (2, 1);

  COMMIT;

  SELECT 'teams' AS table_name, COUNT(*) FROM teams
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'series', COUNT(*) FROM series
UNION ALL
SELECT 'venues', COUNT(*) FROM venues
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'scorecards', COUNT(*) FROM scorecards
UNION ALL
SELECT 'innings', COUNT(*) FROM innings
UNION ALL
SELECT 'batting_performances', COUNT(*) FROM batting_performances
UNION ALL
SELECT 'bowling_performances', COUNT(*) FROM bowling_performances
UNION ALL
SELECT 'rankings', COUNT(*) FROM rankings
UNION ALL
SELECT 'news', COUNT(*) FROM news;
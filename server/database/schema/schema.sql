--
-- PostgreSQL database dump
--

\restrict 72GQDo192UeK7XmSqZZ7Fm8MoMybswgoWHmcjExN0pnQzIdaSswIObwm3nKfUp3

-- Dumped from database version 18.6 (c021049)
-- Dumped by pg_dump version 18.6 (Debian 18.6-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: batting_performances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batting_performances (
    id bigint NOT NULL,
    innings_id bigint NOT NULL,
    player_id bigint NOT NULL,
    runs integer DEFAULT 0,
    balls_faced integer DEFAULT 0,
    fours integer DEFAULT 0,
    sixes integer DEFAULT 0,
    strike_rate numeric(6,2) DEFAULT 0,
    is_out boolean DEFAULT false,
    dismissal_type character varying(50),
    dismissed_by_bowler_id bigint,
    fielder_id bigint,
    dismissal_text text
);


--
-- Name: batting_performances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batting_performances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batting_performances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batting_performances_id_seq OWNED BY public.batting_performances.id;


--
-- Name: bowling_performances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bowling_performances (
    id bigint NOT NULL,
    innings_id bigint NOT NULL,
    player_id bigint NOT NULL,
    overs numeric(5,1) DEFAULT 0,
    maidens integer DEFAULT 0,
    runs_conceded integer DEFAULT 0,
    wickets integer DEFAULT 0,
    economy numeric(6,2) DEFAULT 0,
    balls_bowled integer DEFAULT 0
);


--
-- Name: bowling_performances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bowling_performances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bowling_performances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bowling_performances_id_seq OWNED BY public.bowling_performances.id;


--
-- Name: commentary_event_sequence; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commentary_event_sequence
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commentary_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commentary_events (
    id bigint NOT NULL,
    event_id uuid,
    match_id bigint NOT NULL,
    innings_id bigint,
    delivery_id bigint,
    event_type character varying(50) NOT NULL,
    over_number integer,
    ball_number integer,
    title character varying(255),
    text text,
    highlight_type character varying(50),
    sequence_number bigint DEFAULT nextval('public.commentary_event_sequence'::regclass) NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: commentary_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.commentary_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: commentary_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.commentary_events_id_seq OWNED BY public.commentary_events.id;


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id bigint NOT NULL,
    event_id uuid NOT NULL,
    match_id bigint NOT NULL,
    innings_id bigint NOT NULL,
    over_number integer NOT NULL,
    ball_number integer NOT NULL,
    striker_id bigint NOT NULL,
    non_striker_id bigint,
    bowler_id bigint NOT NULL,
    batsman_runs integer DEFAULT 0 NOT NULL,
    extra_runs integer DEFAULT 0 NOT NULL,
    total_runs integer DEFAULT 0 NOT NULL,
    wide_runs integer DEFAULT 0 NOT NULL,
    no_ball_runs integer DEFAULT 0 NOT NULL,
    bye_runs integer DEFAULT 0 NOT NULL,
    leg_bye_runs integer DEFAULT 0 NOT NULL,
    penalty_runs integer DEFAULT 0 NOT NULL,
    is_four boolean DEFAULT false NOT NULL,
    is_six boolean DEFAULT false NOT NULL,
    is_wicket boolean DEFAULT false NOT NULL,
    wicket_type character varying(50),
    dismissed_player_id bigint,
    fielder_id bigint,
    is_legal_delivery boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: deliveries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.deliveries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: deliveries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.deliveries_id_seq OWNED BY public.deliveries.id;


--
-- Name: innings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.innings (
    id bigint NOT NULL,
    scorecard_id bigint NOT NULL,
    batting_team_id bigint NOT NULL,
    innings_number integer NOT NULL,
    total_runs integer DEFAULT 0,
    wickets integer DEFAULT 0,
    overs numeric(5,1) DEFAULT 0,
    extras integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    legal_balls integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    innings_type character varying(30) DEFAULT 'REGULAR'::character varying NOT NULL,
    super_over_number integer,
    current_striker_id bigint,
    current_non_striker_id bigint,
    current_bowler_id bigint,
    status character varying(30) DEFAULT 'IN_PROGRESS'::character varying NOT NULL,
    completion_reason character varying(40),
    completed_at timestamp with time zone,
    target_runs integer
);


--
-- Name: innings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.innings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: innings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.innings_id_seq OWNED BY public.innings.id;


--
-- Name: match_formats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_formats (
    id bigint NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: match_formats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.match_formats_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: match_formats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.match_formats_id_seq OWNED BY public.match_formats.id;


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id bigint NOT NULL,
    series_id bigint,
    venue_id bigint,
    team1_id bigint NOT NULL,
    team2_id bigint NOT NULL,
    format character varying(30) NOT NULL,
    status character varying(30) NOT NULL,
    start_time timestamp with time zone,
    winner_team_id bigint,
    result text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    format_id bigint,
    CONSTRAINT matches_check CHECK ((team1_id <> team2_id))
);


--
-- Name: matches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.matches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: matches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.matches_id_seq OWNED BY public.matches.id;


--
-- Name: news; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news (
    id bigint NOT NULL,
    title character varying(250) NOT NULL,
    content text NOT NULL,
    image_url text,
    published_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: news_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.news_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: news_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.news_id_seq OWNED BY public.news.id;


--
-- Name: news_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_matches (
    news_id bigint NOT NULL,
    match_id bigint NOT NULL
);


--
-- Name: news_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_players (
    news_id bigint NOT NULL,
    player_id bigint NOT NULL
);


--
-- Name: news_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_series (
    news_id bigint NOT NULL,
    series_id bigint NOT NULL
);


--
-- Name: news_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.news_teams (
    news_id bigint NOT NULL,
    team_id bigint NOT NULL
);


--
-- Name: player_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_teams (
    player_id bigint NOT NULL,
    team_id bigint NOT NULL
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id bigint NOT NULL,
    team_id bigint,
    name character varying(150) NOT NULL,
    country character varying(100),
    role character varying(50),
    batting_style character varying(100),
    bowling_style character varying(100),
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.players_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: players_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.players_id_seq OWNED BY public.players.id;


--
-- Name: rankings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rankings (
    id bigint NOT NULL,
    player_id bigint,
    team_id bigint,
    format character varying(30) NOT NULL,
    category character varying(50) NOT NULL,
    "position" integer NOT NULL,
    rating integer,
    updated_at timestamp with time zone DEFAULT now(),
    format_id bigint,
    CONSTRAINT rankings_check CHECK ((((player_id IS NOT NULL) AND (team_id IS NULL)) OR ((player_id IS NULL) AND (team_id IS NOT NULL))))
);


--
-- Name: rankings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.rankings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: rankings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.rankings_id_seq OWNED BY public.rankings.id;


--
-- Name: scorecards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scorecards (
    id bigint NOT NULL,
    match_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: scorecards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scorecards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scorecards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.scorecards_id_seq OWNED BY public.scorecards.id;


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id bigint NOT NULL,
    name character varying(180) NOT NULL,
    format character varying(30) NOT NULL,
    start_date date,
    end_date date,
    status character varying(30),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    super_over_enabled boolean DEFAULT false NOT NULL,
    gender_category character varying(20) DEFAULT 'MEN'::character varying NOT NULL
);


--
-- Name: series_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.series_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.series_id_seq OWNED BY public.series.id;


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id bigint NOT NULL,
    name character varying(120) NOT NULL,
    short_name character varying(20) NOT NULL,
    country character varying(100),
    logo_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: teams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.teams_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.teams_id_seq OWNED BY public.teams.id;


--
-- Name: venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venues (
    id bigint NOT NULL,
    name character varying(180) NOT NULL,
    city character varying(100),
    country character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: venues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venues_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venues_id_seq OWNED BY public.venues.id;


--
-- Name: batting_performances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batting_performances ALTER COLUMN id SET DEFAULT nextval('public.batting_performances_id_seq'::regclass);


--
-- Name: bowling_performances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bowling_performances ALTER COLUMN id SET DEFAULT nextval('public.bowling_performances_id_seq'::regclass);


--
-- Name: commentary_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentary_events ALTER COLUMN id SET DEFAULT nextval('public.commentary_events_id_seq'::regclass);


--
-- Name: deliveries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries ALTER COLUMN id SET DEFAULT nextval('public.deliveries_id_seq'::regclass);


--
-- Name: innings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.innings ALTER COLUMN id SET DEFAULT nextval('public.innings_id_seq'::regclass);


--
-- Name: match_formats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_formats ALTER COLUMN id SET DEFAULT nextval('public.match_formats_id_seq'::regclass);


--
-- Name: matches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches ALTER COLUMN id SET DEFAULT nextval('public.matches_id_seq'::regclass);


--
-- Name: news id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news ALTER COLUMN id SET DEFAULT nextval('public.news_id_seq'::regclass);


--
-- Name: players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players ALTER COLUMN id SET DEFAULT nextval('public.players_id_seq'::regclass);


--
-- Name: rankings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rankings ALTER COLUMN id SET DEFAULT nextval('public.rankings_id_seq'::regclass);


--
-- Name: scorecards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scorecards ALTER COLUMN id SET DEFAULT nextval('public.scorecards_id_seq'::regclass);


--
-- Name: series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series ALTER COLUMN id SET DEFAULT nextval('public.series_id_seq'::regclass);


--
-- Name: teams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams ALTER COLUMN id SET DEFAULT nextval('public.teams_id_seq'::regclass);


--
-- Name: venues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues ALTER COLUMN id SET DEFAULT nextval('public.venues_id_seq'::regclass);


--
-- Name: batting_performances batting_performances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batting_performances
    ADD CONSTRAINT batting_performances_pkey PRIMARY KEY (id);


--
-- Name: bowling_performances bowling_performances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bowling_performances
    ADD CONSTRAINT bowling_performances_pkey PRIMARY KEY (id);


--
-- Name: commentary_events commentary_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentary_events
    ADD CONSTRAINT commentary_events_event_id_key UNIQUE (event_id);


--
-- Name: commentary_events commentary_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentary_events
    ADD CONSTRAINT commentary_events_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_event_id_key UNIQUE (event_id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: innings innings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.innings
    ADD CONSTRAINT innings_pkey PRIMARY KEY (id);


--
-- Name: match_formats match_formats_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_formats
    ADD CONSTRAINT match_formats_code_key UNIQUE (code);


--
-- Name: match_formats match_formats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_formats
    ADD CONSTRAINT match_formats_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: news_matches news_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_matches
    ADD CONSTRAINT news_matches_pkey PRIMARY KEY (news_id, match_id);


--
-- Name: news news_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news
    ADD CONSTRAINT news_pkey PRIMARY KEY (id);


--
-- Name: news_players news_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_players
    ADD CONSTRAINT news_players_pkey PRIMARY KEY (news_id, player_id);


--
-- Name: news_series news_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_series
    ADD CONSTRAINT news_series_pkey PRIMARY KEY (news_id, series_id);


--
-- Name: news_teams news_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_teams
    ADD CONSTRAINT news_teams_pkey PRIMARY KEY (news_id, team_id);


--
-- Name: player_teams player_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_teams
    ADD CONSTRAINT player_teams_pkey PRIMARY KEY (player_id, team_id);


--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: rankings rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rankings
    ADD CONSTRAINT rankings_pkey PRIMARY KEY (id);


--
-- Name: scorecards scorecards_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scorecards
    ADD CONSTRAINT scorecards_match_id_key UNIQUE (match_id);


--
-- Name: scorecards scorecards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scorecards
    ADD CONSTRAINT scorecards_pkey PRIMARY KEY (id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: commentary_events uq_commentary_sequence_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentary_events
    ADD CONSTRAINT uq_commentary_sequence_number UNIQUE (sequence_number);


--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);


--
-- Name: idx_batting_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batting_player_id ON public.batting_performances USING btree (player_id);


--
-- Name: idx_bowling_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bowling_player_id ON public.bowling_performances USING btree (player_id);


--
-- Name: idx_commentary_event_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commentary_event_type ON public.commentary_events USING btree (event_type);


--
-- Name: idx_commentary_innings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commentary_innings_id ON public.commentary_events USING btree (innings_id);


--
-- Name: idx_commentary_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commentary_match_id ON public.commentary_events USING btree (match_id);


--
-- Name: idx_commentary_sequence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_commentary_sequence ON public.commentary_events USING btree (match_id, sequence_number DESC);


--
-- Name: idx_deliveries_bowler_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_bowler_id ON public.deliveries USING btree (bowler_id);


--
-- Name: idx_deliveries_innings_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_innings_id ON public.deliveries USING btree (innings_id);


--
-- Name: idx_deliveries_innings_over_ball; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_innings_over_ball ON public.deliveries USING btree (innings_id, over_number, ball_number);


--
-- Name: idx_deliveries_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_match_id ON public.deliveries USING btree (match_id);


--
-- Name: idx_deliveries_striker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_striker_id ON public.deliveries USING btree (striker_id);


--
-- Name: idx_innings_scorecard_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_innings_scorecard_id ON public.innings USING btree (scorecard_id);


--
-- Name: idx_matches_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_series_id ON public.matches USING btree (series_id);


--
-- Name: idx_matches_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_start_time ON public.matches USING btree (start_time);


--
-- Name: idx_matches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matches_status ON public.matches USING btree (status);


--
-- Name: idx_news_matches_match_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_matches_match_id ON public.news_matches USING btree (match_id);


--
-- Name: idx_news_players_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_players_player_id ON public.news_players USING btree (player_id);


--
-- Name: idx_news_series_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_series_series_id ON public.news_series USING btree (series_id);


--
-- Name: idx_news_teams_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_news_teams_team_id ON public.news_teams USING btree (team_id);


--
-- Name: idx_players_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_players_team_id ON public.players USING btree (team_id);


--
-- Name: idx_rankings_player_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rankings_player_id ON public.rankings USING btree (player_id);


--
-- Name: idx_rankings_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rankings_team_id ON public.rankings USING btree (team_id);


--
-- Name: batting_performances batting_performances_innings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batting_performances
    ADD CONSTRAINT batting_performances_innings_id_fkey FOREIGN KEY (innings_id) REFERENCES public.innings(id) ON DELETE CASCADE;


--
-- Name: batting_performances batting_performances_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batting_performances
    ADD CONSTRAINT batting_performances_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: bowling_performances bowling_performances_innings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bowling_performances
    ADD CONSTRAINT bowling_performances_innings_id_fkey FOREIGN KEY (innings_id) REFERENCES public.innings(id) ON DELETE CASCADE;


--
-- Name: bowling_performances bowling_performances_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bowling_performances
    ADD CONSTRAINT bowling_performances_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: commentary_events commentary_events_delivery_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentary_events
    ADD CONSTRAINT commentary_events_delivery_id_fkey FOREIGN KEY (delivery_id) REFERENCES public.deliveries(id);


--
-- Name: commentary_events commentary_events_innings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentary_events
    ADD CONSTRAINT commentary_events_innings_id_fkey FOREIGN KEY (innings_id) REFERENCES public.innings(id);


--
-- Name: commentary_events commentary_events_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commentary_events
    ADD CONSTRAINT commentary_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id);


--
-- Name: deliveries deliveries_bowler_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_bowler_id_fkey FOREIGN KEY (bowler_id) REFERENCES public.players(id);


--
-- Name: deliveries deliveries_dismissed_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_dismissed_player_id_fkey FOREIGN KEY (dismissed_player_id) REFERENCES public.players(id);


--
-- Name: deliveries deliveries_fielder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_fielder_id_fkey FOREIGN KEY (fielder_id) REFERENCES public.players(id);


--
-- Name: deliveries deliveries_innings_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_innings_id_fkey FOREIGN KEY (innings_id) REFERENCES public.innings(id);


--
-- Name: deliveries deliveries_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id);


--
-- Name: deliveries deliveries_non_striker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_non_striker_id_fkey FOREIGN KEY (non_striker_id) REFERENCES public.players(id);


--
-- Name: deliveries deliveries_striker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_striker_id_fkey FOREIGN KEY (striker_id) REFERENCES public.players(id);


--
-- Name: batting_performances fk_batting_dismissed_by_bowler; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batting_performances
    ADD CONSTRAINT fk_batting_dismissed_by_bowler FOREIGN KEY (dismissed_by_bowler_id) REFERENCES public.players(id);


--
-- Name: batting_performances fk_batting_fielder; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batting_performances
    ADD CONSTRAINT fk_batting_fielder FOREIGN KEY (fielder_id) REFERENCES public.players(id);


--
-- Name: innings fk_innings_current_bowler; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.innings
    ADD CONSTRAINT fk_innings_current_bowler FOREIGN KEY (current_bowler_id) REFERENCES public.players(id);


--
-- Name: innings fk_innings_current_non_striker; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.innings
    ADD CONSTRAINT fk_innings_current_non_striker FOREIGN KEY (current_non_striker_id) REFERENCES public.players(id);


--
-- Name: innings fk_innings_current_striker; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.innings
    ADD CONSTRAINT fk_innings_current_striker FOREIGN KEY (current_striker_id) REFERENCES public.players(id);


--
-- Name: innings innings_batting_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.innings
    ADD CONSTRAINT innings_batting_team_id_fkey FOREIGN KEY (batting_team_id) REFERENCES public.teams(id);


--
-- Name: innings innings_scorecard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.innings
    ADD CONSTRAINT innings_scorecard_id_fkey FOREIGN KEY (scorecard_id) REFERENCES public.scorecards(id) ON DELETE CASCADE;


--
-- Name: matches matches_format_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_format_id_fkey FOREIGN KEY (format_id) REFERENCES public.match_formats(id);


--
-- Name: matches matches_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id);


--
-- Name: matches matches_team1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team1_id_fkey FOREIGN KEY (team1_id) REFERENCES public.teams(id);


--
-- Name: matches matches_team2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_team2_id_fkey FOREIGN KEY (team2_id) REFERENCES public.teams(id);


--
-- Name: matches matches_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id);


--
-- Name: matches matches_winner_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.teams(id);


--
-- Name: news_matches news_matches_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_matches
    ADD CONSTRAINT news_matches_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: news_matches news_matches_news_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_matches
    ADD CONSTRAINT news_matches_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE;


--
-- Name: news_players news_players_news_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_players
    ADD CONSTRAINT news_players_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE;


--
-- Name: news_players news_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_players
    ADD CONSTRAINT news_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: news_series news_series_news_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_series
    ADD CONSTRAINT news_series_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE;


--
-- Name: news_series news_series_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_series
    ADD CONSTRAINT news_series_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: news_teams news_teams_news_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_teams
    ADD CONSTRAINT news_teams_news_id_fkey FOREIGN KEY (news_id) REFERENCES public.news(id) ON DELETE CASCADE;


--
-- Name: news_teams news_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.news_teams
    ADD CONSTRAINT news_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: player_teams player_teams_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_teams
    ADD CONSTRAINT player_teams_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: player_teams player_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_teams
    ADD CONSTRAINT player_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: players players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: rankings rankings_format_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rankings
    ADD CONSTRAINT rankings_format_id_fkey FOREIGN KEY (format_id) REFERENCES public.match_formats(id);


--
-- Name: rankings rankings_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rankings
    ADD CONSTRAINT rankings_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id);


--
-- Name: rankings rankings_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rankings
    ADD CONSTRAINT rankings_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id);


--
-- Name: scorecards scorecards_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scorecards
    ADD CONSTRAINT scorecards_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 72GQDo192UeK7XmSqZZ7Fm8MoMybswgoWHmcjExN0pnQzIdaSswIObwm3nKfUp3


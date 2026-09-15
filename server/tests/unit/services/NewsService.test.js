import { beforeEach, describe, expect, it, vi } from "vitest";

import NewsService from "../../../src/services/NewsService.js";

import NewsNotFoundError from "../../../src/errors/NewsNotFoundError.js";
import MatchNotFoundError from "../../../src/errors/MatchNotFoundError.js";
import PlayerNotFoundError from "../../../src/errors/PlayerNotFoundError.js";
import TeamNotFoundError from "../../../src/errors/TeamNotFoundError.js";
import SeriesNotFoundError from "../../../src/errors/SeriesNotFoundError.js";

describe("NewsService", () => {
    let newsRepository;
    let matchRepository;
    let playerRepository;
    let teamRepository;
    let seriesRepository;
    let newsService;

    beforeEach(() => {
        newsRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findByPlayerId: vi.fn(),
            findByTeamId: vi.fn(),
            findBySeriesId: vi.fn(),
            findByMatchId: vi.fn()
        };

        matchRepository = {
            findById: vi.fn()
        };

        playerRepository = {
            findById: vi.fn()
        };

        teamRepository = {
            findById: vi.fn()
        };

        seriesRepository = {
            findById: vi.fn()
        };

        newsService = new NewsService(
            newsRepository,
            matchRepository,
            playerRepository,
            teamRepository,
            seriesRepository
        );

        vi.clearAllMocks();
    });

    describe("getNews()", () => {
        it("should return all news", async () => {
            const news = [
                { id: 1, title: "India wins series" },
                { id: 2, title: "Player reaches milestone" }
            ];

            newsRepository.findAll.mockResolvedValue(news);

            const result = await newsService.getNews();

            expect(newsRepository.findAll)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(news);
        });
    });

    describe("getNewsById()", () => {
        it("should return news when it exists", async () => {
            const news = {
                id: 1,
                title: "India wins series"
            };

            newsRepository.findById.mockResolvedValue(news);

            const result = await newsService.getNewsById(1);

            expect(newsRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(news);
        });

        it("should throw NewsNotFoundError when news does not exist", async () => {
            newsRepository.findById.mockResolvedValue(null);

            await expect(
                newsService.getNewsById(999)
            ).rejects.toBeInstanceOf(NewsNotFoundError);
        });
    });

    describe("getNewsByPlayerId()", () => {
        it("should return news for existing player", async () => {
            const player = {
                id: 10,
                name: "Virat Kohli"
            };

            const news = [
                { id: 1, playerId: 10 }
            ];

            playerRepository.findById.mockResolvedValue(player);
            newsRepository.findByPlayerId.mockResolvedValue(news);

            const result =
                await newsService.getNewsByPlayerId(10);

            expect(playerRepository.findById)
                .toHaveBeenCalledWith(10);

            expect(newsRepository.findByPlayerId)
                .toHaveBeenCalledWith(10);

            expect(result).toEqual(news);
        });

        it("should throw PlayerNotFoundError when player does not exist", async () => {
            playerRepository.findById.mockResolvedValue(null);

            await expect(
                newsService.getNewsByPlayerId(999)
            ).rejects.toBeInstanceOf(PlayerNotFoundError);

            expect(newsRepository.findByPlayerId)
                .not.toHaveBeenCalled();
        });
    });

    describe("getNewsByTeamId()", () => {
        it("should return news for existing team", async () => {
            const team = {
                id: 20,
                name: "India"
            };

            const news = [
                { id: 2, teamId: 20 }
            ];

            teamRepository.findById.mockResolvedValue(team);
            newsRepository.findByTeamId.mockResolvedValue(news);

            const result =
                await newsService.getNewsByTeamId(20);

            expect(teamRepository.findById)
                .toHaveBeenCalledWith(20);

            expect(newsRepository.findByTeamId)
                .toHaveBeenCalledWith(20);

            expect(result).toEqual(news);
        });

        it("should throw TeamNotFoundError when team does not exist", async () => {
            teamRepository.findById.mockResolvedValue(null);

            await expect(
                newsService.getNewsByTeamId(999)
            ).rejects.toBeInstanceOf(TeamNotFoundError);

            expect(newsRepository.findByTeamId)
                .not.toHaveBeenCalled();
        });
    });

    describe("getNewsBySeriesId()", () => {
        it("should return news for existing series", async () => {
            const series = {
                id: 30,
                name: "Border-Gavaskar Trophy"
            };

            const news = [
                { id: 3, seriesId: 30 }
            ];

            seriesRepository.findById.mockResolvedValue(series);
            newsRepository.findBySeriesId.mockResolvedValue(news);

            const result =
                await newsService.getNewsBySeriesId(30);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(30);

            expect(newsRepository.findBySeriesId)
                .toHaveBeenCalledWith(30);

            expect(result).toEqual(news);
        });

        it("should throw SeriesNotFoundError when series does not exist", async () => {
            seriesRepository.findById.mockResolvedValue(null);

            await expect(
                newsService.getNewsBySeriesId(999)
            ).rejects.toBeInstanceOf(SeriesNotFoundError);

            expect(newsRepository.findBySeriesId)
                .not.toHaveBeenCalled();
        });
    });

    describe("getNewsByMatchId()", () => {
        it("should return news for existing match", async () => {
            const match = {
                id: 40
            };

            const news = [
                { id: 4, matchId: 40 }
            ];

            matchRepository.findById.mockResolvedValue(match);
            newsRepository.findByMatchId.mockResolvedValue(news);

            const result =
                await newsService.getNewsByMatchId(40);

            expect(matchRepository.findById)
                .toHaveBeenCalledWith(40);

            expect(newsRepository.findByMatchId)
                .toHaveBeenCalledWith(40);

            expect(result).toEqual(news);
        });

        it("should throw MatchNotFoundError when match does not exist", async () => {
            matchRepository.findById.mockResolvedValue(null);

            await expect(
                newsService.getNewsByMatchId(999)
            ).rejects.toBeInstanceOf(MatchNotFoundError);

            expect(newsRepository.findByMatchId)
                .not.toHaveBeenCalled();
        });
    });
});

// SRP — tests only NewsService application/business behavior.
// DIP — service depends on repository abstractions rather than PostgreSQL implementations.
// Dependency Injection — all five repositories are injected through the constructor.
// LSP — mocks substitute the real repository implementations.
// Service Layer Pattern — entity validation/orchestration stays in the service.
// Repository Pattern — persistence behavior remains behind repository interfaces.
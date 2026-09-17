import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsController from "../../../src/controllers/NewsController.js";

describe("NewsController", () => {

    let newsService;
    let controller;
    let req;
    let res;
    let next;

    beforeEach(() => {

        newsService = {
            getNews: vi.fn(),
            getNewsById: vi.fn(),
            getNewsByPlayerId: vi.fn(),
            getNewsByTeamId: vi.fn(),
            getNewsBySeriesId: vi.fn(),
            getNewsByMatchId: vi.fn()
        };

        controller = new NewsController(newsService);

        req = {
            params: {}
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        next = vi.fn();
    });


    describe("getNews()", () => {

        it("should return all news", async () => {

            const news = [
                { id: 1, title: "India wins" },
                { id: 2, title: "Series announced" }
            ];

            newsService.getNews.mockResolvedValue(news);

            await controller.getNews(req, res, next);

            expect(newsService.getNews).toHaveBeenCalledOnce();

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: news
            });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            const error = new Error("Service failure");

            newsService.getNews.mockRejectedValue(error);

            await controller.getNews(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getNewsById()", () => {

        it("should return news by id", async () => {

            req.params.newsId = "1";

            const news = {
                id: 1,
                title: "India wins"
            };

            newsService.getNewsById.mockResolvedValue(news);

            await controller.getNewsById(req, res, next);

            expect(newsService.getNewsById)
                .toHaveBeenCalledWith("1");

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: news
            });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.newsId = "999";

            const error = new Error("News not found");

            newsService.getNewsById.mockRejectedValue(error);

            await controller.getNewsById(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getNewsByPlayerId()", () => {

        it("should return news by player id", async () => {

            req.params.playerId = "10";

            const news = [
                { id: 1, playerId: 10 }
            ];

            newsService.getNewsByPlayerId.mockResolvedValue(news);

            await controller.getNewsByPlayerId(req, res, next);

            expect(newsService.getNewsByPlayerId)
                .toHaveBeenCalledWith("10");

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: news
            });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.playerId = "10";

            const error = new Error("Service failure");

            newsService.getNewsByPlayerId.mockRejectedValue(error);

            await controller.getNewsByPlayerId(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getNewsByTeamId()", () => {

        it("should return news by team id", async () => {

            req.params.teamId = "5";

            const news = [
                { id: 1, teamId: 5 }
            ];

            newsService.getNewsByTeamId.mockResolvedValue(news);

            await controller.getNewsByTeamId(req, res, next);

            expect(newsService.getNewsByTeamId)
                .toHaveBeenCalledWith("5");

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: news
            });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.teamId = "5";

            const error = new Error("Service failure");

            newsService.getNewsByTeamId.mockRejectedValue(error);

            await controller.getNewsByTeamId(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getNewsBySeriesId()", () => {

        it("should return news by series id", async () => {

            req.params.seriesId = "3";

            const news = [
                { id: 1, seriesId: 3 }
            ];

            newsService.getNewsBySeriesId.mockResolvedValue(news);

            await controller.getNewsBySeriesId(req, res, next);

            expect(newsService.getNewsBySeriesId)
                .toHaveBeenCalledWith("3");

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: news
            });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.seriesId = "3";

            const error = new Error("Service failure");

            newsService.getNewsBySeriesId.mockRejectedValue(error);

            await controller.getNewsBySeriesId(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });


    describe("getNewsByMatchId()", () => {

        it("should return news by match id", async () => {

            req.params.matchId = "20";

            const news = [
                { id: 1, matchId: 20 }
            ];

            newsService.getNewsByMatchId.mockResolvedValue(news);

            await controller.getNewsByMatchId(req, res, next);

            expect(newsService.getNewsByMatchId)
                .toHaveBeenCalledWith("20");

            expect(res.status).toHaveBeenCalledWith(200);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                data: news
            });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.matchId = "20";

            const error = new Error("Service failure");

            newsService.getNewsByMatchId.mockRejectedValue(error);

            await controller.getNewsByMatchId(req, res, next);

            expect(next).toHaveBeenCalledWith(error);
        });

    });

});

// SRP (Single Responsibility Principle) — The test file tests only NewsController behavior.
// Dependency Injection (DI) — NewsController receives the mocked newsService through its constructor.
// DIP (Dependency Inversion Principle) — Controller tests depend on the service interface/behavior rather than a real database/service implementation.
// Separation of Concerns — Controller HTTP behavior is tested independently from service and repository logic.
// Testability — NewsService, req, res, and next are mocked so each controller method can be tested in isolation.
// Interface/Contract Testing — Verifies the controller calls the expected service method with the expected arguments and returns the expected HTTP response contract.
// Error Propagation — Verifies controller errors are delegated to next(error) rather than handled as business logic inside the controller.
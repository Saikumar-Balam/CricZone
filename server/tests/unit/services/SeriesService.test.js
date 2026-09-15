import { beforeEach, describe, expect, it, vi } from "vitest";

import SeriesService from "../../../src/services/SeriesService.js";
import SeriesNotFoundError from "../../../src/errors/SeriesNotFoundError.js";

describe("SeriesService", () => {
    let seriesRepository;
    let seriesService;

    beforeEach(() => {
        seriesRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findMatchesBySeriesId: vi.fn()
        };

        seriesService = new SeriesService(seriesRepository);

        vi.clearAllMocks();
    });

    describe("getSeries()", () => {
        it("should return all series", async () => {
            const series = [
                {
                    id: 1,
                    name: "Border-Gavaskar Trophy"
                },
                {
                    id: 2,
                    name: "Ashes"
                }
            ];

            seriesRepository.findAll.mockResolvedValue(series);

            const result = await seriesService.getSeries();

            expect(seriesRepository.findAll)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(series);
        });
    });

    describe("getSeriesById()", () => {
        it("should return series when series exists", async () => {
            const series = {
                id: 1,
                name: "Border-Gavaskar Trophy"
            };

            seriesRepository.findById.mockResolvedValue(series);

            const result =
                await seriesService.getSeriesById(1);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(series);
        });

        it("should throw SeriesNotFoundError when series does not exist", async () => {
            seriesRepository.findById.mockResolvedValue(null);

            await expect(
                seriesService.getSeriesById(999)
            ).rejects.toBeInstanceOf(SeriesNotFoundError);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(999);
        });
    });

    describe("getMatchesBySeriesId()", () => {
        it("should return matches when series exists", async () => {
            const series = {
                id: 1,
                name: "Border-Gavaskar Trophy"
            };

            const matches = [
                {
                    id: 10,
                    series_id: 1
                },
                {
                    id: 11,
                    series_id: 1
                }
            ];

            seriesRepository.findById
                .mockResolvedValue(series);

            seriesRepository.findMatchesBySeriesId
                .mockResolvedValue(matches);

            const result =
                await seriesService.getMatchesBySeriesId(1);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(seriesRepository.findMatchesBySeriesId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(matches);
        });

        it("should throw SeriesNotFoundError and not query matches when series does not exist", async () => {
            seriesRepository.findById.mockResolvedValue(null);

            await expect(
                seriesService.getMatchesBySeriesId(999)
            ).rejects.toBeInstanceOf(SeriesNotFoundError);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(999);

            expect(seriesRepository.findMatchesBySeriesId)
                .not.toHaveBeenCalled();
        });
    });

    describe("ensureSeriesIdExists()", () => {
        it("should return series when series exists", async () => {
            const series = {
                id: 1,
                name: "Border-Gavaskar Trophy"
            };

            seriesRepository.findById.mockResolvedValue(series);

            const result =
                await seriesService.ensureSeriesIdExists(1);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(series);
        });

        it("should throw SeriesNotFoundError when series does not exist", async () => {
            seriesRepository.findById.mockResolvedValue(null);

            await expect(
                seriesService.ensureSeriesIdExists(999)
            ).rejects.toBeInstanceOf(SeriesNotFoundError);

            expect(seriesRepository.findById)
                .toHaveBeenCalledWith(999);
        });
    });
});
// SRP — SeriesService handles series application logic only.
// DIP — depends on the repository abstraction.
// Dependency Injection — repository is constructor-injected.
// LSP — mocked repository substitutes the actual repository implementation.
// OCP — repository implementation can change without modifying the service.
// Service Layer Pattern — series validation/orchestration stays in the service.
// Repository Pattern — persistence remains behind seriesRepository
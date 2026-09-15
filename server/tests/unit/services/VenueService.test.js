import { beforeEach, describe, expect, it, vi } from "vitest";

import VenueService from "../../../src/services/VenueService.js";
import VenueNotFoundError from "../../../src/errors/VenueNotFoundError.js";

describe("VenueService", () => {
    let venueRepository;
    let venueService;

    beforeEach(() => {
        venueRepository = {
            findAll: vi.fn(),
            findById: vi.fn(),
            findMatchesByVenueId: vi.fn()
        };

        venueService = new VenueService(venueRepository);

        vi.clearAllMocks();
    });

    describe("getVenues()", () => {
        it("should return all venues", async () => {
            const venues = [
                {
                    id: 1,
                    name: "Rajiv Gandhi International Stadium",
                    city: "Hyderabad"
                },
                {
                    id: 2,
                    name: "Wankhede Stadium",
                    city: "Mumbai"
                }
            ];

            venueRepository.findAll.mockResolvedValue(venues);

            const result = await venueService.getVenues();

            expect(venueRepository.findAll)
                .toHaveBeenCalledTimes(1);

            expect(result).toEqual(venues);
        });
    });

    describe("getVenuesById()", () => {
        it("should return venue when venue exists", async () => {
            const venue = {
                id: 1,
                name: "Rajiv Gandhi International Stadium",
                city: "Hyderabad"
            };

            venueRepository.findById.mockResolvedValue(venue);

            const result =
                await venueService.getVenuesById(1);

            expect(venueRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(venue);
        });

        it("should throw VenueNotFoundError when venue does not exist", async () => {
            venueRepository.findById.mockResolvedValue(null);

            await expect(
                venueService.getVenuesById(999)
            ).rejects.toBeInstanceOf(VenueNotFoundError);

            expect(venueRepository.findById)
                .toHaveBeenCalledWith(999);
        });
    });

    describe("getMatchesByVenueId()", () => {
        it("should return matches when venue exists", async () => {
            const venue = {
                id: 1,
                name: "Rajiv Gandhi International Stadium"
            };

            const matches = [
                {
                    id: 100,
                    venue_id: 1
                },
                {
                    id: 101,
                    venue_id: 1
                }
            ];

            venueRepository.findById
                .mockResolvedValue(venue);

            venueRepository.findMatchesByVenueId
                .mockResolvedValue(matches);

            const result =
                await venueService.getMatchesByVenueId(1);

            expect(venueRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(venueRepository.findMatchesByVenueId)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(matches);
        });

        it("should throw VenueNotFoundError and not query matches when venue does not exist", async () => {
            venueRepository.findById.mockResolvedValue(null);

            await expect(
                venueService.getMatchesByVenueId(999)
            ).rejects.toBeInstanceOf(VenueNotFoundError);

            expect(venueRepository.findMatchesByVenueId)
                .not.toHaveBeenCalled();
        });
    });

    describe("ensureVenueExists()", () => {
        it("should return venue when venue exists", async () => {
            const venue = {
                id: 1,
                name: "Rajiv Gandhi International Stadium"
            };

            venueRepository.findById.mockResolvedValue(venue);

            const result =
                await venueService.ensureVenueExists(1);

            expect(venueRepository.findById)
                .toHaveBeenCalledWith(1);

            expect(result).toEqual(venue);
        });

        it("should throw VenueNotFoundError when venue does not exist", async () => {
            venueRepository.findById.mockResolvedValue(null);

            await expect(
                venueService.ensureVenueExists(999)
            ).rejects.toBeInstanceOf(VenueNotFoundError);

            expect(venueRepository.findById)
                .toHaveBeenCalledWith(999);
        });
    });
});

// SRP — VenueService handles venue use cases only.
// DIP — service depends on repository behavior rather than PostgreSQL implementation.
// Dependency Injection — repository is constructor-injected.
// LSP — mocked repository can substitute the concrete repository.
// OCP — repository implementation can change without changing the service.
// Service Layer Pattern — validation/orchestration stays in the service.
// Repository Pattern — database operations stay behind venueRepository.
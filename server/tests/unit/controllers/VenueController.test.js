import { beforeEach, describe, expect, it, vi } from "vitest";
import VenueController from "../../../src/controllers/VenueController.js";

describe("VenueController", () => {

    let venueService;
    let controller;
    let req;
    let res;
    let next;

    beforeEach(() => {

        venueService = {
            getVenues: vi.fn(),
            getVenuesById: vi.fn(),
            getMatchesByVenueId: vi.fn()
        };

        // Constructor Dependency Injection
        controller = new VenueController(venueService);

        req = {
            params: {}
        };

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        next = vi.fn();
    });


    describe("getVenues()", () => {

        it("should return all venues", async () => {

            const venues = [
                { id: 1, name: "Rajiv Gandhi Stadium" },
                { id: 2, name: "Wankhede Stadium" }
            ];

            venueService.getVenues.mockResolvedValue(venues);

            await controller.getVenues(req, res, next);

            expect(venueService.getVenues)
                .toHaveBeenCalledOnce();

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: venues
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            const error = new Error("Service failure");

            venueService.getVenues.mockRejectedValue(error);

            await controller.getVenues(req, res, next);

            expect(venueService.getVenues)
                .toHaveBeenCalledOnce();

            expect(next)
                .toHaveBeenCalledWith(error);

            expect(res.status)
                .not.toHaveBeenCalled();

            expect(res.json)
                .not.toHaveBeenCalled();
        });

    });


    describe("getVenuesById()", () => {

        it("should return venue by id", async () => {

            req.params.venueId = "5";

            const venue = {
                id: 5,
                name: "Rajiv Gandhi Stadium"
            };

            venueService.getVenuesById
                .mockResolvedValue(venue);

            await controller.getVenuesById(req, res, next);

            expect(venueService.getVenuesById)
                .toHaveBeenCalledWith("5");

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: venue
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.venueId = "999";

            const error = new Error("Venue not found");

            venueService.getVenuesById
                .mockRejectedValue(error);

            await controller.getVenuesById(req, res, next);

            expect(venueService.getVenuesById)
                .toHaveBeenCalledWith("999");

            expect(next)
                .toHaveBeenCalledWith(error);

            expect(res.status)
                .not.toHaveBeenCalled();
        });

    });


    describe("getMatchesByVenueId()", () => {

        it("should return matches by venue id", async () => {

            req.params.venueId = "5";

            const matches = [
                { id: 10, venueId: 5 },
                { id: 11, venueId: 5 }
            ];

            venueService.getMatchesByVenueId
                .mockResolvedValue(matches);

            await controller.getMatchesByVenueId(req, res, next);

            expect(venueService.getMatchesByVenueId)
                .toHaveBeenCalledWith("5");

            expect(res.status)
                .toHaveBeenCalledWith(200);

            expect(res.json)
                .toHaveBeenCalledWith({
                    success: true,
                    data: matches
                });

            expect(next).not.toHaveBeenCalled();
        });


        it("should forward service error to next", async () => {

            req.params.venueId = "999";

            const error = new Error("Service failure");

            venueService.getMatchesByVenueId
                .mockRejectedValue(error);

            await controller.getMatchesByVenueId(req, res, next);

            expect(venueService.getMatchesByVenueId)
                .toHaveBeenCalledWith("999");

            expect(next)
                .toHaveBeenCalledWith(error);

            expect(res.status)
                .not.toHaveBeenCalled();
        });

    });

});

// SRP — Tests only VenueController HTTP/controller responsibilities.
// Constructor DI — Mock venueService is injected into the controller.
// DIP — Controller is tested against the service contract rather than a concrete repository/database.
// Separation of Concerns — No SQL, PostgreSQL, cache, or business logic is tested here.
// Testability — Service and Express dependencies are mocked for isolated testing.
// Interface/Contract Testing — Verifies venueId, service invocation, status code, and { success, data } response.
// Error Propagation — Verifies service errors are forwarded through next(error).
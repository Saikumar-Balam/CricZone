import { beforeEach, describe, expect, it } from "vitest";

import VenueRequestValidator
    from "../../../src/validators/VenueRequestValidator.js";

import ValidationError
    from "../../../src/errors/ValidationError.js";

describe("VenueRequestValidator", () => {
    let validator;

    beforeEach(() => {
        validator = new VenueRequestValidator();
    });

    describe("validateVenueId()", () => {
        it("should return venueId when positive integer number is provided", () => {
            const result = validator.validateVenueId(10);

            expect(result).toBe(10);
        });

        it("should convert valid numeric string to integer", () => {
            const result = validator.validateVenueId("25");

            expect(result).toBe(25);
            expect(typeof result).toBe("number");
        });

        it("should throw ValidationError when venueId is zero", () => {
            expect(() =>
                validator.validateVenueId(0)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when venueId is negative", () => {
            expect(() =>
                validator.validateVenueId(-5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when venueId is decimal", () => {
            expect(() =>
                validator.validateVenueId(1.5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when venueId is non-numeric", () => {
            expect(() =>
                validator.validateVenueId("abc")
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError with correct message and code", () => {
            try {
                validator.validateVenueId("invalid");
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);

                expect(error.message)
                    .toBe("venueId must be a positive integer");

                expect(error.code)
                    .toBe("INVALID_VENUE_ID");
            }
        });
    });
});
// Abstraction — extends VenueValidator.
// SRP — handles venue-ID validation only.
// OCP — implementation can evolve without changing consumers.
// LSP — concrete validator can substitute the abstraction.
// DIP support — higher layers can depend on the validator contract.
// Separation of Concerns — validation stays outside controllers/services.
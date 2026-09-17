import { beforeEach, describe, expect, it } from "vitest";

import SeriesRequestValidator
    from "../../../src/validators/SeriesRequestValidator.js";

import ValidationError
    from "../../../src/errors/ValidationError.js";

describe("SeriesRequestValidator", () => {
    let validator;

    beforeEach(() => {
        validator = new SeriesRequestValidator();
    });

    describe("validateSeriesId()", () => {
        it("should return seriesId when positive integer number is provided", () => {
            const result = validator.validateSeriesId(10);

            expect(result).toBe(10);
        });

        it("should convert valid numeric string to integer", () => {
            const result = validator.validateSeriesId("25");

            expect(result).toBe(25);
            expect(typeof result).toBe("number");
        });

        it("should throw ValidationError when seriesId is zero", () => {
            expect(() =>
                validator.validateSeriesId(0)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when seriesId is negative", () => {
            expect(() =>
                validator.validateSeriesId(-5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when seriesId is decimal", () => {
            expect(() =>
                validator.validateSeriesId(1.5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when seriesId is non-numeric", () => {
            expect(() =>
                validator.validateSeriesId("abc")
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError with correct message and code", () => {
            try {
                validator.validateSeriesId("invalid");
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);

                expect(error.message)
                    .toBe("seriesId must be a positive integer");

                expect(error.code)
                    .toBe("INVALID_SERIES_ID");
            }
        });
    });
});

// SRP — handles series-ID validation only.
// Abstraction — extends the SeriesValidator contract.
// OCP — implementation can change without changing consumers.
// LSP — SeriesRequestValidator can substitute SeriesValidator.
// DIP support — consumers can depend on the validator abstraction.
// Separation of Concerns — validation stays outside controller/service logic.
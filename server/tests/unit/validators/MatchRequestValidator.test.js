import { beforeEach, describe, expect, it } from "vitest";

import MatchRequestValidator
    from "../../../src/validators/MatchRequestValidator.js";

import ValidationError
    from "../../../src/errors/ValidationError.js";

describe("MatchRequestValidator", () => {
    let validator;

    beforeEach(() => {
        validator = new MatchRequestValidator();
    });

    describe("validateMatchId()", () => {
        it("should return matchId when positive integer number is provided", () => {
            const result = validator.validateMatchId(10);

            expect(result).toBe(10);
        });

        it("should convert valid numeric string to integer", () => {
            const result = validator.validateMatchId("25");

            expect(result).toBe(25);
            expect(typeof result).toBe("number");
        });

        it("should throw ValidationError when matchId is zero", () => {
            expect(() =>
                validator.validateMatchId(0)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when matchId is negative", () => {
            expect(() =>
                validator.validateMatchId(-5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when matchId is decimal", () => {
            expect(() =>
                validator.validateMatchId(1.5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when matchId is non-numeric", () => {
            expect(() =>
                validator.validateMatchId("abc")
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError with correct message and code", () => {
            try {
                validator.validateMatchId("invalid");
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);

                expect(error.message)
                    .toBe("MatchId must be a positive integer");

                expect(error.code)
                    .toBe("INVALID_MATCH_ID");
            }
        });
    });
});
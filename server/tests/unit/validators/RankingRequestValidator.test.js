import { beforeEach, describe, expect, it } from "vitest";

import RankingRequestValidator
    from "../../../src/validators/RankingRequestValidator.js";

import ValidationError
    from "../../../src/errors/ValidationError.js";

describe("RankingRequestValidator", () => {
    let validator;

    beforeEach(() => {
        validator = new RankingRequestValidator();
    });

    describe("validateRankingId()", () => {
        it("should return rankingId when positive integer number is provided", () => {
            const result = validator.validateRankingId(10);

            expect(result).toBe(10);
        });

        it("should convert valid numeric string to integer", () => {
            const result = validator.validateRankingId("25");

            expect(result).toBe(25);
            expect(typeof result).toBe("number");
        });

        it("should throw ValidationError when rankingId is zero", () => {
            expect(() =>
                validator.validateRankingId(0)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when rankingId is negative", () => {
            expect(() =>
                validator.validateRankingId(-5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when rankingId is decimal", () => {
            expect(() =>
                validator.validateRankingId(1.5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when rankingId is non-numeric", () => {
            expect(() =>
                validator.validateRankingId("abc")
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError with correct message and code", () => {
            try {
                validator.validateRankingId("invalid");
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);

                expect(error.message)
                    .toBe("rankingId must be a positive integer");

                expect(error.code)
                    .toBe("INVALID_RANKING_ID");
            }
        });
    });
});
// SRP — handles ranking-ID validation only.
// Abstraction — implements the RankingValidator contract.
// OCP — implementation can evolve without changing consumers.
// LSP — concrete validator substitutes the validator abstraction.
// DIP support — higher layers can depend on the validator contract.
// Separation of Concerns — malformed ID → ValidationError; nonexistent valid ID → RankingNotFoundError.
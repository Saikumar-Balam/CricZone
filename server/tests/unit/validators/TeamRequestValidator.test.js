import { beforeEach, describe, expect, it } from "vitest";

import TeamRequestValidator
    from "../../../src/validators/TeamRequestValidator.js";

import ValidationError
    from "../../../src/errors/ValidationError.js";

describe("TeamRequestValidator", () => {
    let validator;

    beforeEach(() => {
        validator = new TeamRequestValidator();
    });

    describe("validateTeamId()", () => {
        it("should return teamId when positive integer number is provided", () => {
            const result = validator.validateTeamId(10);

            expect(result).toBe(10);
        });

        it("should convert valid numeric string to integer", () => {
            const result = validator.validateTeamId("25");

            expect(result).toBe(25);
            expect(typeof result).toBe("number");
        });

        it("should throw ValidationError when teamId is zero", () => {
            expect(() =>
                validator.validateTeamId(0)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when teamId is negative", () => {
            expect(() =>
                validator.validateTeamId(-5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when teamId is decimal", () => {
            expect(() =>
                validator.validateTeamId(1.5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when teamId is non-numeric", () => {
            expect(() =>
                validator.validateTeamId("abc")
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError with correct message and code", () => {
            try {
                validator.validateTeamId("invalid");
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);

                expect(error.message)
                    .toBe("teamId must be a positive integer");

                expect(error.code)
                    .toBe("INVALID_TEAM_ID");
            }
        });
    });
});

// SRP — handles only team-ID validation.
// Abstraction — extends the TeamValidator contract.
// OCP — implementation can evolve independently.
// LSP — TeamRequestValidator substitutes the TeamValidator abstraction.
// DIP support — consumers can depend on the validator contract.
// Separation of Concerns — validation remains outside controller/service logic.
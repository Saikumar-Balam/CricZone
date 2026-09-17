import { beforeEach, describe, expect, it } from "vitest";

import { PlayerRequestValidator }
    from "../../../src/validators/PlayerRequestValidator.js";

import ValidationError
    from "../../../src/errors/ValidationError.js";

describe("PlayerRequestValidator", () => {
    let validator;

    beforeEach(() => {
        validator = new PlayerRequestValidator();
    });

    describe("validatePlayerId()", () => {
        it("should return playerId when positive integer number is provided", () => {
            const result = validator.validatePlayerId(10);

            expect(result).toBe(10);
        });

        it("should convert valid numeric string to integer", () => {
            const result = validator.validatePlayerId("25");

            expect(result).toBe(25);
            expect(typeof result).toBe("number");
        });

        it("should throw ValidationError when playerId is zero", () => {
            expect(() =>
                validator.validatePlayerId(0)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when playerId is negative", () => {
            expect(() =>
                validator.validatePlayerId(-5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when playerId is decimal", () => {
            expect(() =>
                validator.validatePlayerId(1.5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when playerId is non-numeric", () => {
            expect(() =>
                validator.validatePlayerId("abc")
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError with correct message and code", () => {
            try {
                validator.validatePlayerId("invalid");
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);

                expect(error.message)
                    .toBe("playerId must be a postive integer");

                expect(error.code)
                    .toBe("INVALID_PLAYER_ID");
            }
        });
    });
});

// Abstraction — extends the PlayerValidator contract.
// SRP — responsible only for player request validation.
// OCP — validation implementation can evolve independently.
// LSP — concrete validator substitutes the PlayerValidator abstraction.
// DIP support — consumers can depend on the validator abstraction.
// Separation of Concerns — validation is isolated from controller/service logic.
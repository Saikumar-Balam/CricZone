import { beforeEach, describe, expect, it } from "vitest";

import NewsRequestValidator
    from "../../../src/validators/NewsRequestValidator.js";

import ValidationError
    from "../../../src/errors/ValidationError.js";

describe("NewsRequestValidator", () => {
    let validator;

    beforeEach(() => {
        validator = new NewsRequestValidator();
    });

    describe("validateNewsId()", () => {
        it("should return newsId when positive integer number is provided", () => {
            const result = validator.validateNewsId(10);

            expect(result).toBe(10);
        });

        it("should convert valid numeric string to integer", () => {
            const result = validator.validateNewsId("25");

            expect(result).toBe(25);
            expect(typeof result).toBe("number");
        });

        it("should throw ValidationError when newsId is zero", () => {
            expect(() =>
                validator.validateNewsId(0)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when newsId is negative", () => {
            expect(() =>
                validator.validateNewsId(-5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when newsId is decimal", () => {
            expect(() =>
                validator.validateNewsId(1.5)
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError when newsId is non-numeric", () => {
            expect(() =>
                validator.validateNewsId("abc")
            ).toThrow(ValidationError);
        });

        it("should throw ValidationError with correct message and code", () => {
            try {
                validator.validateNewsId("invalid");
            } catch (error) {
                expect(error).toBeInstanceOf(ValidationError);

                expect(error.message)
                    .toBe("newsId must be a positive integer");

                expect(error.code)
                    .toBe("INVALID_NEWS_ID");
            }
        });
    });
});

// SRP — validates and normalizes newsId only.
// OCP — News validation can change without modifying consumers.
// LSP — NewsRequestValidator substitutes the NewsValidator abstraction.
// DIP — consumers can depend on the validation contract.
// Strategy-style validation — News-specific validation is encapsulated.
// Separation of Concerns — validation stays outside controllers/services.
import {
    describe,
    it,
    expect,
    vi
} from "vitest"

import KafkaConsumerRetryStrategy
    from "../../../src/messaging/KafkaConsumerRetryStrategy.js"


describe("KafkaConsumerRetryStrategy", () => {

    it("should execute operation once when it succeeds immediately", async () => {

        const strategy =
            new KafkaConsumerRetryStrategy({
                maxRetries: 3,
                initialDelayMs: 10
            })


        const operation =
            vi.fn()
                .mockResolvedValue(
                    "success"
                )


        const result =
            await strategy.execute(
                operation
            )


        expect(result)
            .toBe("success")

        expect(operation)
            .toHaveBeenCalledTimes(1)
    })


    it("should retry once when operation fails once then succeeds", async () => {

        const strategy =
            new KafkaConsumerRetryStrategy({
                maxRetries: 3,
                initialDelayMs: 1
            })


        const operation =
            vi.fn()
                .mockRejectedValueOnce(
                    new Error("temporary failure")
                )
                .mockResolvedValue(
                    "success"
                )


        const result =
            await strategy.execute(
                operation
            )


        expect(result)
            .toBe("success")

        expect(operation)
            .toHaveBeenCalledTimes(2)
    })


    it("should retry twice when operation fails twice then succeeds", async () => {

        const strategy =
            new KafkaConsumerRetryStrategy({
                maxRetries: 3,
                initialDelayMs: 1
            })


        const operation =
            vi.fn()
                .mockRejectedValueOnce(
                    new Error("failure-1")
                )
                .mockRejectedValueOnce(
                    new Error("failure-2")
                )
                .mockResolvedValue(
                    "success"
                )


        const result =
            await strategy.execute(
                operation
            )


        expect(result)
            .toBe("success")

        expect(operation)
            .toHaveBeenCalledTimes(3)
    })


    it("should throw after maximum retries are exhausted", async () => {

        const strategy =
            new KafkaConsumerRetryStrategy({
                maxRetries: 3,
                initialDelayMs: 1
            })


        const error =
            new Error(
                "persistent failure"
            )


        const operation =
            vi.fn()
                .mockRejectedValue(
                    error
                )


        await expect(
            strategy.execute(
                operation
            )
        ).rejects.toBe(
            error
        )


        /*
         * Initial attempt
         * +
         * 3 retries
         */
        expect(operation)
            .toHaveBeenCalledTimes(4)
    })


    it("should use exponential backoff between retries", async () => {

        const strategy =
            new KafkaConsumerRetryStrategy({
                maxRetries: 3,
                initialDelayMs: 500,
                multiplier: 2,
                maxDelayMs: 5000
            })


        const delaySpy =
            vi.spyOn(
                strategy,
                "delay"
            )
            .mockResolvedValue(
                undefined
            )


        const operation =
            vi.fn()
                .mockRejectedValueOnce(
                    new Error("failure-1")
                )
                .mockRejectedValueOnce(
                    new Error("failure-2")
                )
                .mockRejectedValueOnce(
                    new Error("failure-3")
                )
                .mockResolvedValue(
                    "success"
                )


        await strategy.execute(
            operation
        )


        expect(delaySpy)
            .toHaveBeenNthCalledWith(
                1,
                500
            )

        expect(delaySpy)
            .toHaveBeenNthCalledWith(
                2,
                1000
            )

        expect(delaySpy)
            .toHaveBeenNthCalledWith(
                3,
                2000
            )
    })


    it("should not allow retry delay to exceed maxDelayMs", async () => {

        const strategy =
            new KafkaConsumerRetryStrategy({
                maxRetries: 4,
                initialDelayMs: 1000,
                multiplier: 3,
                maxDelayMs: 5000
            })


        const delaySpy =
            vi.spyOn(
                strategy,
                "delay"
            )
            .mockResolvedValue(
                undefined
            )


        const operation =
            vi.fn()
                .mockRejectedValue(
                    new Error(
                        "temporary failure"
                    )
                )


        await expect(
            strategy.execute(
                operation
            )
        ).rejects.toThrow(
            "temporary failure"
        )


        expect(delaySpy)
            .toHaveBeenNthCalledWith(
                1,
                1000
            )

        expect(delaySpy)
            .toHaveBeenNthCalledWith(
                2,
                3000
            )

        expect(delaySpy)
            .toHaveBeenNthCalledWith(
                3,
                5000
            )

        expect(delaySpy)
            .toHaveBeenNthCalledWith(
                4,
                5000
            )
    })


    it("should perform zero retries when maxRetries is zero", async () => {

        const strategy =
            new KafkaConsumerRetryStrategy({
                maxRetries: 0
            })


        const operation =
            vi.fn()
                .mockRejectedValue(
                    new Error(
                        "failure"
                    )
                )


        await expect(
            strategy.execute(
                operation
            )
        ).rejects.toThrow(
            "failure"
        )


        expect(operation)
            .toHaveBeenCalledTimes(1)
    })

})

// Strategy Pattern — retry algorithm is independently testable.
// SRP — tests target only retry-policy behavior.
// OCP — retry policy can be replaced without changing consumer logic.
// DIP — consumer will depend on the retry strategy abstraction.
// Test Isolation — delays are mocked; no Kafka/Aiven dependency is required.
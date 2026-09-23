import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import KafkaAdminHealthChecker
    from "../../../src/messaging/KafkaAdminHealthChecker.js"


describe("KafkaAdminHealthChecker", () =>
{
    let kafkaAdmin
    let healthChecker


    beforeEach(() =>
    {
        kafkaAdmin = {
            describeCluster:
                vi.fn()
        }

        healthChecker =
            new KafkaAdminHealthChecker(
                kafkaAdmin
            )
    })


    it(
        "should return healthy when Kafka cluster has brokers",
        async () =>
        {
            kafkaAdmin.describeCluster
                .mockResolvedValue({
                    brokers: [
                        {
                            nodeId: 1,
                            host: "broker-1",
                            port: 9092
                        }
                    ]
                })


            const result =
                await healthChecker.check()


            expect(result).toEqual({
                healthy: true
            })

            expect(
                kafkaAdmin.describeCluster
            ).toHaveBeenCalledTimes(1)
        }
    )


    it(
        "should return unhealthy when Kafka cluster has no brokers",
        async () =>
        {
            kafkaAdmin.describeCluster
                .mockResolvedValue({
                    brokers: []
                })


            const result =
                await healthChecker.check()


            expect(result.healthy)
                .toBe(false)

            expect(result.error)
                .toBeInstanceOf(Error)

            expect(result.error.message)
                .toBe(
                    "Kafka cluster has no available brokers"
                )
        }
    )


    it(
        "should return unhealthy when Kafka health check fails",
        async () =>
        {
            const kafkaError =
                new Error(
                    "Kafka unavailable"
                )


            kafkaAdmin.describeCluster
                .mockRejectedValue(
                    kafkaError
                )


            const result =
                await healthChecker.check()


            expect(result).toEqual({
                healthy: false,
                error: kafkaError
            })
        }
    )


    it(
        "should return unhealthy when broker metadata is missing",
        async () =>
        {
            kafkaAdmin.describeCluster
                .mockResolvedValue({})


            const result =
                await healthChecker.check()


            expect(result.healthy)
                .toBe(false)

            expect(result.error)
                .toBeInstanceOf(Error)
        }
    )
})

// Unit isolation — KafkaJS is mocked; no real broker is required.
// DI — fake kafkaAdmin is injected into the checker.
// SRP — tests verify only Kafka health-check behavior.
// DIP — checker behavior can be tested independently of Kafka infrastructure.
// Deterministic testing — healthy, empty-cluster, metadata-missing, and exception paths are controlled explicitly.
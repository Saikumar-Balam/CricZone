import { describe, it, expect } from "vitest";
import { createTestKafka } from "../../helpers/testKafka.js";

describe("Kafka Test Isolation Integration", () => {
    it("should use an isolated Kafka test topic", async () => {
        const testTopic = process.env.TEST_KAFKA_TOPIC
        expect(testTopic).toBeDefined()
        expect(testTopic).toBeDefined()
        expect(testTopic).toBe("criczone.test.live-events")
        expect(testTopic).not.toBe("criczone.live-events")
    })

    it("should verify test topic exists in Kafka", async () => {
        const kafka = createTestKafka()
        const admin = kafka.admin()
        try{
            await admin.connect()
            const topics = await admin.listTopics()
            expect(topics).toContain(process.env.TEST_KAFKA_TOPIC)
        }
        finally {
            await admin.disconnect()
        }
    }, 20000)

    it("should use an isolated consumer group", async () => {
        const kafka = createTestKafka()
        const groupId = `criczone-test-isolation.${Date.now()}`
        const consumer = kafka.consumer({
            groupId
        })

        try{
            await consumer.connect()
            expect(groupId).toMatch(/^criczone-test-/)
        }
        finally {
            await consumer.disconnect()
        }
    }, 20000)
})

// SRP — Tests only Kafka test-environment isolation.
// Factory Pattern — createTestKafka() owns Kafka test-client creation.
// Encapsulation — Broker/TLS/SASL configuration stays inside the helper.
// Separation of Concerns — Test topic, consumer groups, and development infrastructure remain separated.
// DI — Kafka infrastructure is supplied independently.
// DIP — Tests don't depend on low-level Aiven connection configuration.
// Fail-Fast / Guard Clause — Assertions prevent tests from silently using the development topic.
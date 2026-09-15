import { describe, it, expect } from "vitest";
import { createTestKafka } from "../../helpers/testKafka.js";

describe("Kafka Consumer Integration", () => {
    it("should connect to Kafka Consumer", async () => {
        const kafka = createTestKafka()
        const consumer = kafka.consumer({
            groupId: "criczone-test-consumer"
        })
        try{
            await consumer.connect()
            expect(consumer).toBeDefined()
        }
        finally {
            await consumer.disconnect()
        }
    }, 20000)
})

// LLD 

// SRP — Test verifies only Kafka consumer connectivity.
// Factory Pattern — createTestKafka() centralizes test Kafka creation.
// DI — Kafka infrastructure is supplied independently to the test.
// Encapsulation — SSL, CA, SASL, credentials, and brokers remain hidden in the helper.
// Separation of Concerns — Consumer testing is separated from Kafka configuration.
// DIP — Test logic stays independent of low-level Kafka connection configuration.
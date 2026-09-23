import { describe, it, expect } from "vitest";
import { createTestKafka, createTestKafkaProducer } from "../../helpers/testKafka.js";

describe("Kafka Producer Integration",  () => {
    it("should connect to Kafka Producer", async () => {
        const kafka = createTestKafka()
        const producer = createTestKafkaProducer(kafka)
        try{
            await producer.connect()
            expect(producer).toBeDefined()
            
        }
        finally {
            await producer.disconnect()
        }
    }, 20000)
})

// SRP — Test only verifies producer connectivity.
// Factory Pattern — createTestKafka() centralizes Kafka client creation.
// DI — Test receives Kafka infrastructure through the factory-created instance.
// Separation of Concerns — Kafka configuration remains outside the test.
// Encapsulation — Broker, SSL, CA, and SASL details stay inside the Kafka test helper.
// DIP — Test logic does not depend directly on low-level Kafka configuration.
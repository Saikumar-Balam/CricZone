import {describe, it, expect} from "vitest"
import { createTestKafka } from "../../helpers/testKafka.js"

describe("Kafka Integration", () => {
    it("should connect to Kafka broker", async () => {
        const kafka = createTestKafka()
        const admin = kafka.admin()
        try {
            await admin.connect()
            const cluster = await admin.describeCluster()
            expect(cluster).toBeDefined()
            expect(cluster.brokers.length).toBeGreaterThan(0)
        }
        finally{
            await admin.disconnect()
        }
    }, 20000)
})

// SRP — Separates Kafka test-client creation from test execution.
// Factory Pattern — Centralizes creation of Kafka test instances through createTestKafka().
// Encapsulation — Hides Kafka broker configuration and client creation details.
// Separation of Concerns — Separates test configuration, Kafka setup, and connection verification.
// Dependency Injection (DI) — Allows Kafka test infrastructure to be supplied independently to tests.
// DIP — Keeps test logic independent of low-level Kafka configuration details.
import {Kafka} from "kafkajs"
import fs from "node:fs"
export function createTestKafka()
{
    if(!process.env.TEST_KAFKA_BROKERS)
    {
        throw new Error("TEST_KAFKA_BROKERS is required for Kafka Integration tests")
    }
    if(!process.env.TEST_KAFKA_CA_PATH)
    {
        throw new Error("TEST_KAFKA_CA_PATH is required for Kafka Integration tests")
    }
    if(!process.env.TEST_KAFKA_USERNAME)
    {
        throw new Error("TEST_KAFKA_USERNAME is required for Kafka Integration tests")
    }
    if(!process.env.TEST_KAFKA_PASSWORD)
    {
        throw new Error("TEST_KAFKA_PASSWORD is required for Kafka Integration tests")
    }
    const brokers = process.env.TEST_KAFKA_BROKERS.split(",").map(broker =>broker.trim())
    return new Kafka({
        clientId: "criczone-test",
        brokers,
        ssl: {
            ca: [
                fs.readFileSync(process.env.TEST_KAFKA_CA_PATH, "utf-8")
        ]
        },
        sasl: {
            mechanism: "scram-sha-256",
            username: process.env.TEST_KAFKA_USERNAME,
            password: process.env.TEST_KAFKA_PASSWORD
        }
    })
}
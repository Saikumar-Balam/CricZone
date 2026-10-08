
import { Kafka, Partitioners } from "kafkajs";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

export function createTestKafka() {
    const brokerList = process.env.TEST_KAFKA_BROKERS;

    if (!brokerList) {
        throw new Error(
            "TEST_KAFKA_BROKERS is required for Kafka integration tests"
        );
    }

    const brokers = brokerList
        .split(",")
        .map(broker => broker.trim())
        .filter(Boolean);

    const isLocalKafka = brokers.every(broker => {
        const hostname = broker.substring(0, broker.lastIndexOf(":"));
        return ["localhost", "127.0.0.1"].includes(hostname);
    });

    const config = {
        clientId: `criczone-test-${randomUUID()}`,
        brokers,

        connectionTimeout: 10000,
        authenticationTimeout: 10000,
        requestTimeout: 30000,

        retry: {
            initialRetryTime: 300,
            retries: 5,
            factor: 0.2,
            multiplier: 2,
            maxRetryTime: 30000
        }
    };

    if (isLocalKafka) {
        config.ssl = false;
    } else {
        const {
            TEST_KAFKA_CA_PATH,
            TEST_KAFKA_USERNAME,
            TEST_KAFKA_PASSWORD
        } = process.env;

        if (!TEST_KAFKA_CA_PATH) {
            throw new Error("TEST_KAFKA_CA_PATH is required for remote Kafka");
        }

        if (!TEST_KAFKA_USERNAME || !TEST_KAFKA_PASSWORD) {
            throw new Error("Kafka SASL credentials are required for remote Kafka");
        }

        config.ssl = {
            ca: [fs.readFileSync(TEST_KAFKA_CA_PATH, "utf-8")]
        };

        config.sasl = {
            mechanism: "scram-sha-256",
            username: TEST_KAFKA_USERNAME,
            password: TEST_KAFKA_PASSWORD
        };
    }

    return new Kafka(config);
}

export function createTestKafkaProducer(kafka) {
    return kafka.producer({
        createPartitioner: Partitioners.DefaultPartitioner
    });
}

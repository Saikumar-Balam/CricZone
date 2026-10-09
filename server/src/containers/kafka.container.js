
import { Kafka, Partitioners } from "kafkajs";
import fs from "node:fs";

import KafkaAdminHealthChecker
    from "../messaging/KafkaAdminHealthChecker.js";


const brokers = (process.env.KAFKA_BROKERS || "")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);


if (brokers.length === 0) {
    throw new Error(
        "Missing required environment variable: KAFKA_BROKERS"
    );
}


function getKafkaCa() {
    if (process.env.NODE_ENV === "production") {
        const kafkaCa = process.env.KAFKA_CA;

        if (!kafkaCa) {
            throw new Error(
                "Missing required environment variable: KAFKA_CA"
            );
        }

        return kafkaCa
            .replace(/\\n/g, "\n")
            .trim();
    }

    const caPath = process.env.KAFKA_CA_PATH;

    if (!caPath) {
        throw new Error(
            "Missing required environment variable: KAFKA_CA_PATH"
        );
    }

    return fs.readFileSync(caPath, "utf8").trim();
}


function createKafkaConfig() {
    const isLocalCI =
        process.env.NODE_ENV === "test" &&
        brokers.every((broker) =>
            /^(localhost|127\.0\.0\.1):\d+$/.test(broker)
        );

    const config = {
        clientId:
            process.env.KAFKA_CLIENT_ID ||
            "criczone-api",

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

    if (isLocalCI) {
        config.ssl = false;
    } else {
        const username = process.env.KAFKA_USERNAME;
        const password = process.env.KAFKA_PASSWORD;

        if (!username || !password) {
            throw new Error(
                "Missing required Kafka SASL credentials"
            );
        }

        config.ssl = {
            ca: [getKafkaCa()]
        };

        config.sasl = {
            mechanism: "scram-sha-256",
            username,
            password
        };
    }

    return config;
}


const kafka = new Kafka(createKafkaConfig());


const kafkaProducer = kafka.producer({
    createPartitioner:
        Partitioners.DefaultPartitioner
});


const kafkaConsumer = kafka.consumer({
    groupId:
        process.env.KAFKA_LIVE_CONSUMER_GROUP ||
        "criczone-live-processing"
});


const kafkaAdmin = kafka.admin();


const kafkaHealthChecker =
    new KafkaAdminHealthChecker(kafkaAdmin);


export {
    kafka,
    kafkaProducer,
    kafkaConsumer,
    kafkaAdmin,
    kafkaHealthChecker
};


// LLD principles:
// SRP: Container constructs Kafka infrastructure dependencies.
// Encapsulation: CA loading is centralized.
// Configuration: Broker and authentication settings use environment variables.
// Fail Fast: Invalid broker or required secure configuration throws.
// Separation of Concerns: Kafka setup is separate from business logic.
// Security: Remote brokers require TLS and SASL/SCRAM.

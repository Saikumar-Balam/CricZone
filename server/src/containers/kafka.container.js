import { Kafka, Partitioners } from "kafkajs";
import fs from "node:fs";

import KafkaAdminHealthChecker
    from "../messaging/KafkaAdminHealthChecker.js";


const brokers = process.env.KAFKA_BROKERS
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);


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

    if (!process.env.KAFKA_CA_PATH) {
        throw new Error(
            "Missing required environment variable: KAFKA_CA_PATH"
        );
    }

    return fs.readFileSync(
        process.env.KAFKA_CA_PATH,
        "utf8"
    ).trim();
}


const kafka = new Kafka({
    clientId:
        process.env.KAFKA_CLIENT_ID ||
        "criczone-api",

    brokers,

    ssl: {
        ca: [
            getKafkaCa()
        ]
    },

    sasl: {
        mechanism: "scram-sha-256",

        username:
            process.env.KAFKA_USERNAME,

        password:
            process.env.KAFKA_PASSWORD
    },

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
});


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
    new KafkaAdminHealthChecker(
        kafkaAdmin
    );


export {
    kafka,
    kafkaProducer,
    kafkaConsumer,
    kafkaAdmin,
    kafkaHealthChecker
};


// LLD principles used:
//
// SRP — this container is responsible for constructing and exposing
// Kafka infrastructure dependencies.
//
// Encapsulation — Kafka CA loading and normalization are centralized
// in getKafkaCa().
//
// Configuration over hardcoding — brokers, credentials, consumer
// group and TLS CA come from environment configuration.
//
// Environment independence — development loads the CA from a file,
// while production receives the CA through environment configuration.
//
// Separation of Concerns — Kafka infrastructure construction remains
// separate from application/business logic.
//
// Fail Fast — missing Kafka CA configuration causes startup failure
// instead of silently creating an invalid Kafka connection.
//
// Secure by Default — Kafka communication continues to use TLS and
// SASL authentication.
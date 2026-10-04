import { Kafka, Partitioners } from "kafkajs";
import fs from "node:fs";

import KafkaAdminHealthChecker
    from "../messaging/KafkaAdminHealthChecker.js";


const brokers = process.env.KAFKA_BROKERS
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);


function getKafkaCa()
{
    if (process.env.NODE_ENV === "production")
    {
        return process.env.KAFKA_CA.replace(/\\n/g, "\n");
    }

    return fs.readFileSync(
        process.env.KAFKA_CA_PATH,
        "utf8"
    );
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
// SRP — Kafka client construction and transport configuration
// remain inside Kafka infrastructure.
//
// Encapsulation — certificate loading is centralized in getKafkaCa().
//
// Configuration over hardcoding — Kafka credentials and TLS
// configuration come from environment configuration.
//
// Environment independence — development can use a certificate file,
// while Azure production can inject the certificate directly.
//
// Separation of Concerns — retry policy remains Kafka
// infrastructure configuration.
//
// Fail Fast — KafkaJS connection failures propagate after retries.
import {
    Kafka,
    Partitioners
} from "kafkajs";

import fs from "node:fs";
import { randomUUID } from "node:crypto";


export function createTestKafka()
{
    if (!process.env.TEST_KAFKA_BROKERS)
    {
        throw new Error(
            "TEST_KAFKA_BROKERS is required for Kafka integration tests"
        );
    }

    if (!process.env.TEST_KAFKA_CA_PATH)
    {
        throw new Error(
            "TEST_KAFKA_CA_PATH is required for Kafka integration tests"
        );
    }

    if (!process.env.TEST_KAFKA_USERNAME)
    {
        throw new Error(
            "TEST_KAFKA_USERNAME is required for Kafka integration tests"
        );
    }

    if (!process.env.TEST_KAFKA_PASSWORD)
    {
        throw new Error(
            "TEST_KAFKA_PASSWORD is required for Kafka integration tests"
        );
    }


    const brokers =
        process.env.TEST_KAFKA_BROKERS
            .split(",")
            .map(
                broker =>
                    broker.trim()
            );


    return new Kafka({

        /*
         * Every integration-test Kafka instance
         * receives its own identifiable client ID.
         */
        clientId:
            `criczone-test-${randomUUID()}`,

        brokers,

        ssl: {
            ca: [
                fs.readFileSync(
                    process.env.TEST_KAFKA_CA_PATH,
                    "utf-8"
                )
            ]
        },

        sasl: {
            mechanism:
                "scram-sha-256",

            username:
                process.env.TEST_KAFKA_USERNAME,

            password:
                process.env.TEST_KAFKA_PASSWORD
        },


        /*
         * Remote Kafka infrastructure.
         *
         * Keep these consistent with the reliability
         * behavior already established for CricZone.
         */
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
}


export function createTestKafkaProducer(kafka)
{
    return kafka.producer({
        createPartitioner:
            Partitioners.DefaultPartitioner
    });
}
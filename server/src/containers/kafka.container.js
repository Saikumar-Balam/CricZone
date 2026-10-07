import { Kafka, Partitioners } from "kafkajs";
import fs from "node:fs";
import tls from "node:tls";

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

        const normalizedCa = kafkaCa
            .replace(/\\n/g, "\n")
            .trim();

        console.log("[Kafka TLS Diagnostic]", {
            rawLength: kafkaCa.length,
            normalizedLength: normalizedCa.length,
            startsCorrectly:
                normalizedCa.startsWith(
                    "-----BEGIN CERTIFICATE-----"
                ),
            endsCorrectly:
                normalizedCa.endsWith(
                    "-----END CERTIFICATE-----"
                ),
            newlineCount:
                (normalizedCa.match(/\n/g) || []).length
        });

        return normalizedCa;
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


function testKafkaTlsConnection() {
    if (process.env.NODE_ENV !== "production") {
        return;
    }

    const [broker] = brokers;

    if (!broker) {
        console.error(
            "[Node TLS Diagnostic] No Kafka broker configured"
        );
        return;
    }

    const lastColonIndex =
        broker.lastIndexOf(":");

    if (lastColonIndex === -1) {
        console.error(
            "[Node TLS Diagnostic] Invalid Kafka broker format"
        );
        return;
    }

    const host =
        broker.slice(0, lastColonIndex);

    const port =
        Number(
            broker.slice(lastColonIndex + 1)
        );

    console.log(
        "[Node TLS Diagnostic] Testing direct TLS connection..."
    );

    const socket = tls.connect({
        host,
        port,
        servername: host,

        ca: [
            getKafkaCa()
        ],

        rejectUnauthorized: true
    });


    socket.once("secureConnect", () => {
        console.log("[Node TLS Diagnostic]", {
            authorized:
                socket.authorized,

            authorizationError:
                socket.authorizationError || null,

            protocol:
                socket.getProtocol()
        });

        socket.end();
    });


    socket.once("error", (error) => {
        console.error(
            "[Node TLS Diagnostic] FAILED",
            {
                name:
                    error.name,

                code:
                    error.code,

                message:
                    error.message
            }
        );
    });


    socket.setTimeout(10000, () => {
        console.error(
            "[Node TLS Diagnostic] FAILED: connection timeout"
        );

        socket.destroy();
    });
}


testKafkaTlsConnection();


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
// SRP — Kafka client construction and TLS diagnostics have
// clearly separated responsibilities.
//
// Encapsulation — certificate loading and normalization are
// centralized in getKafkaCa().
//
// Configuration over hardcoding — Kafka brokers, credentials,
// consumer group and TLS CA come from environment configuration.
//
// Environment independence — development loads the CA from a
// certificate file while Azure production injects it directly.
//
// Separation of Concerns — Node TLS diagnostics are isolated
// from KafkaJS transport configuration.
//
// Fail Fast — invalid Kafka/TLS configuration remains visible
// during startup.
//
// Secure by Default — TLS certificate verification remains
// enabled with rejectUnauthorized: true.
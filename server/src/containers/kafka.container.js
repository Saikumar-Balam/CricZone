import {Kafka, Partitioners} from "kafkajs"
import fs from "node:fs";
import KafkaAdminHealthChecker from "../messaging/KafkaAdminHealthChecker.js";

const brokers = process.env.KAFKA_BROKERS.split(",").map((broker) => broker.trim())

const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || "criczone-api",
    brokers,

      ssl: {
    ca: [
      fs.readFileSync(
        process.env.KAFKA_CA_PATH,
        "utf8"
      )
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
})

const kafkaProducer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner
})

const kafkaConsumer = kafka.consumer({groupId: process.env.KAFKA_LIVE_CONSUMER_GROUP ||
    "criczone-live-processing"
})

const kafkaAdmin = kafka.admin()
const kafkaHealthChecker = new KafkaAdminHealthChecker(kafkaAdmin)

export{ kafka, kafkaProducer, kafkaConsumer, kafkaAdmin, kafkaHealthChecker}

// Do not create Kafka producers inside services.

// Separation of Concerns — retry policy belongs to Kafka infrastructure.
// SRP — KafkaEventProducer publishes; it doesn't implement transport retry algorithms.
// Adapter Pattern — Kafka-specific behavior remains behind KafkaEventProducer.
// DI/DIP — services depend on the producer abstraction rather than KafkaJS.
// Configuration over hard-coded business logic — transport resilience is configured centrally.
// Fail Fast after exhaustion — once KafkaJS retries are exhausted, the error propagates instead of being swallowed.
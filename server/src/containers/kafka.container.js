import {Kafka} from "kafkajs"
import fs from "node:fs";

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
  }
})

const kafkaProducer = kafka.producer()

const kafkaConsumer = kafka.consumer({groupId: process.env.KAFKA_LIVE_CONSUMER_GROUP} ||
    "criczone-live-processing"
)

export{ kafka, kafkaProducer, kafkaConsumer}

// Do not create Kafka producers inside services.
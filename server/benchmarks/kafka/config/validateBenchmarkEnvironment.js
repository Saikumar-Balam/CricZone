export async function validateBenchmarkEnvironment(
  kafka,
  config
) {
  const admin = kafka.admin();

  await admin.connect();

  try {
    const cluster = await admin.describeCluster();

    if (!cluster.brokers?.length) {
      throw new Error("No Kafka brokers available");
    }

    if (cluster.brokers.length !== 1) {
      throw new Error(
        "Expected an isolated single-broker Kafka cluster"
      );
    }

    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic: config.topic,
          numPartitions: 3,
          replicationFactor: 1
        }
      ]
    });

    const metadata = await admin.fetchTopicMetadata({
      topics: [config.topic]
    });

    const topic = metadata.topics.find(
      item => item.name === config.topic
    );

    if (!topic || topic.partitions.length !== 3) {
      throw new Error(
        "Kafka benchmark topic validation failed"
      );
    }

    console.log("Kafka benchmark environment verified");
    console.log("Brokers:", config.brokers.join(", "));
    console.log("Topic:", config.topic);
    console.log("Partitions:", topic.partitions.length);
    console.log("Consumer group:", config.consumerGroup);

    return metadata;
  } finally {
    await admin.disconnect();
  }
}
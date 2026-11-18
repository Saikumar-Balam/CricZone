
import { loadBenchmarkConfig } from "./benchmarkConfig.js";

export async function validateBenchmarkEnvironment(client) {
  const config = loadBenchmarkConfig();

  if (!client?.isReady) {
    throw new Error("Benchmark Valkey client is not connected");
  }

  const pong = await client.ping();

  if (pong !== "PONG") {
    throw new Error("Valkey PING verification failed");
  }

  const serverInfo = await client.info("server");

  const versionMatch = serverInfo.match(
    /^valkey_version:([^\r\n]+)/m
  );

  if (!versionMatch) {
    throw new Error(
      "Could not verify Valkey server version"
    );
  }

  const actualVersion = versionMatch[1].trim();

  if (actualVersion !== config.expectedValkeyVersion) {
    throw new Error(
      `Valkey version mismatch: expected ${config.expectedValkeyVersion}, received ${actualVersion}`
    );
  }

  console.log("Benchmark environment validated:", {
    version: actualVersion,
    keyPrefix: config.keyPrefix,
    connection: "local-only"
  });

  return config;
}

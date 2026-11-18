
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function loadBenchmarkConfig() {
  const connectionUrl = process.env.BENCHMARK_VALKEY_URL;

  if (!connectionUrl) {
    throw new Error("BENCHMARK_VALKEY_URL is required");
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(connectionUrl);
  } catch {
    throw new Error("Invalid BENCHMARK_VALKEY_URL");
  }

  if (
    parsedUrl.protocol !== "redis:" ||
    !ALLOWED_HOSTS.has(parsedUrl.hostname) ||
    parsedUrl.port !== "6379" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.pathname !== "" && parsedUrl.pathname !== "/" ||
    parsedUrl.search ||
    parsedUrl.hash
  ) {
    throw new Error(
      "SAFETY ERROR: Benchmarks require an unauthenticated local Valkey instance on port 6379"
    );
  }

  return Object.freeze({
    connectionUrl,
    keyPrefix: "benchmark:criczone:",
    expectedValkeyVersion: "9.1.2"
  });
}

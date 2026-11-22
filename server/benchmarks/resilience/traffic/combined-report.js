
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve(
  "benchmarks/resilience/traffic/reports"
);

const sources = [
  {
    key: "valkey",
    file: "valkey-http.json",
    phase: "25.7.5.1",
    run: process.env.VALKEY_RUN_ID
  },
  {
    key: "postgres",
    file: "postgres-http.json",
    phase: "25.7.5.2",
    run: process.env.POSTGRES_RUN_ID
  },
  {
    key: "kafka",
    file: "kafka-http.json",
    phase: "25.7.5.3",
    run: process.env.KAFKA_RUN_ID
  },
  {
    key: "websocket",
    file: "websocket-http.json",
    phase: "25.7.5.4",
    run: process.env.WEBSOCKET_RUN_ID
  }
];

function requireCheck(condition, message) {
  assert(condition, message);
}

function checkFields(report, fields, key) {
  for (const field of fields) {
    requireCheck(
      report[field] === true,
      `${key}: ${field} is not true`
    );
  }
}

function checkTraffic(report, phase, expected) {
  const row = report.traffic?.[phase];

  requireCheck(
    row && Number.isInteger(row.requests),
    `${report.phase}: invalid ${phase} traffic`
  );

  requireCheck(
    row.requests >= 10,
    `${report.phase}: insufficient ${phase} requests`
  );

  expected(row);
}

function validate(source, report) {
  const key = source.key;

  requireCheck(
    report.phase === source.phase,
    `${key}: incorrect phase`
  );

  requireCheck(
    report.isolated === true,
    `${key}: isolation not confirmed`
  );

  requireCheck(
    report.passed === true,
    `${key}: benchmark did not pass`
  );

  requireCheck(
    Array.isArray(report.failures) &&
    report.failures.length === 0,
    `${key}: benchmark failures present`
  );

  requireCheck(
    typeof report.runId === "string" &&
    /^[0-9a-f-]{36}$/i.test(report.runId),
    `${key}: invalid benchmark run UUID`
  );

  if (key === "valkey") {
    checkFields(report, [
      "outageConfirmed",
      "postgresFallbackUsed",
      "invalidationCommitted",
      "workerRepairedCache",
      "sameRedisClientRecovered"
    ], key);

    for (const phase of [
      "baseline", "outage", "recovery"
    ]) {
      checkTraffic(report, phase, row => {
        requireCheck(
          row.failures === 0 &&
          row.successes === row.requests,
          `Valkey: failed ${phase} HTTP traffic`
        );
      });
    }
  }

  if (key === "postgres") {
    checkFields(report, [
      "baselineCached",
      "postgresStopped",
      "outageDetected",
      "failClosedDuringOutage",
      "postgresRestarted",
      "originalPoolRecovered",
      "staleCacheBypassed",
      "outboxRepairedCache",
      "recoveryHealthy"
    ], key);

    for (const phase of [
      "baseline", "outage", "recovery"
    ]) {
      checkTraffic(report, phase, row => {
        const expectedStatus =
          phase === "outage" ? "status503" : "status200";

        requireCheck(
          row.unexpectedResponses === 0 &&
          row[expectedStatus] === row.requests &&
          row.timeoutsOrErrors === 0,
          `PostgreSQL: unexpected ${phase} behavior`
        );
      });
    }
  }

  if (key === "kafka") {
    checkFields(report, [
      "baselinePublishingSucceeded",
      "brokerStopped",
      "publishingFailureDetected",
      "noFalseAcknowledgements",
      "brokerRestarted",
      "originalProducerRecovered",
      "independentHttpTrafficSurvived",
      "postRecoveryPublishingSucceeded"
    ], key);

    for (const phase of [
      "baseline", "outage", "recovery"
    ]) {
      checkTraffic(report, phase, row => {
        requireCheck(
          row.clientErrors === 0 &&
          row.publishes >= 5 &&
          row.healthRequests >= 5 &&
          row.requests ===
            row.publishes + row.healthRequests,
          `Kafka: invalid ${phase} traffic`
        );

        if (phase === "outage") {
          requireCheck(
            row.unavailable === row.publishes &&
            row.successes === row.healthRequests,
            "Kafka: incorrect outage response counts"
          );
        } else {
          requireCheck(
            row.unavailable === 0 &&
            row.successes === row.requests,
            `Kafka: failed ${phase} publishing`
          );
        }
      });
    }
  }

  if (key === "websocket") {
    checkFields(report, [
      "baselineHealthy",
      "serverCrashDetected",
      "outagePublishingRejected",
      "serverRestarted",
      "clientsReconnected",
      "roomSubscriptionsRestored",
      "postRecoveryDelivered"
    ], key);

    requireCheck(
      report.clientCount === 5 &&
      report.duplicateDeliveries === 0 &&
      Number.isFinite(report.reconnectLatencyMs),
      "WebSocket: invalid connection evidence"
    );

    for (const phase of [
      "baseline", "outage", "recovery"
    ]) {
      const row = report.traffic?.[phase];

      requireCheck(
        row && row.attempts >= 10,
        `WebSocket: insufficient ${phase} traffic`
      );

      if (phase === "outage") {
        requireCheck(
          row.acknowledged === 0 &&
          row.rejected === row.attempts,
          "WebSocket: outage attempts were acknowledged"
        );
      } else {
        requireCheck(
          row.acknowledged === row.attempts &&
          row.rejected === 0,
          `WebSocket: ${phase} publishing failed`
        );
      }
    }

    requireCheck(
      report.traffic.delivery.baselineClientDeliveries ===
        report.traffic.baseline.acknowledged *
          report.clientCount,
      "WebSocket: baseline deliveries incomplete"
    );

    requireCheck(
      report.traffic.delivery.recoveryClientDeliveries ===
        report.traffic.recovery.acknowledged *
          report.clientCount,
      "WebSocket: recovery deliveries incomplete"
    );
  }
}

function sumRequests(report, key) {
  const phases = [
    "baseline", "outage", "recovery", "transition"
  ];

  const field =
    key === "websocket" ? "attempts" : "requests";

  return phases.reduce(
    (total, phase) =>
      total + (report.traffic?.[phase]?.[field] ?? 0),
    0
  );
}

function sourceLink(runId) {
  return [
    "https://github.com",
    process.env.GITHUB_REPOSITORY,
    "actions/runs",
    runId
  ].join("/");
}

try {
  requireCheck(
    process.env.GITHUB_ACTIONS === "true",
    "This report requires GitHub Actions"
  );

  requireCheck(
    process.env.GITHUB_REPOSITORY ===
      "Saikumar-Balam/CricZone",
    "Unexpected repository"
  );

  const results = {};

  for (const source of sources) {
    requireCheck(
      /^[0-9]+$/.test(source.run ?? ""),
      `Missing/invalid source run: ${source.key}`
    );

    const filePath = path.join(DIR, source.file);
    const bytes = fs.readFileSync(filePath);
    const data = JSON.parse(bytes.toString("utf8"));

    validate(source, data);

    results[source.key] = {
      phase: data.phase,
      scenario: data.scenario,
      ciRunId: source.run,
      benchmarkRunId: data.runId,
      sha256: createHash("sha256")
        .update(bytes)
        .digest("hex"),
      requests: sumRequests(data, source.key),
      traffic: data.traffic,
      warnings: data.warnings ?? [],
      reconnectLatencyMs:
        data.reconnectLatencyMs ?? null,
      duplicateDeliveries:
        data.duplicateDeliveries ?? null,
      passed: true
    };
  }

  const totalRequests = Object.values(results)
    .reduce((sum, item) => sum + item.requests, 0);

  const combined = {
    phase: "25.7.5.5",
    scenario: "combined_traffic_resilience_evidence",
    generatedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY,
    generatedFrom: "GitHub Actions artifacts",
    scenarioCount: 4,
    passedScenarios: 4,
    totalRequests,
    scenarios: results,
    limitations: [
      "Tests execute in isolated CI infrastructure.",
      "Minimal HTTP benchmark hosts do not prove full production API behavior.",
      "Single Kafka broker testing does not prove multi-broker resilience.",
      "Kafka publish failures can have uncertain commit outcomes.",
      "Offline WebSocket events are not replayed.",
      "The WebSocket test uses one server, not ECS failover.",
      "Durable exactly-once business processing is not established."
    ],
    failures: [],
    passed: true
  };

  fs.mkdirSync(DIR, { recursive: true });

  fs.writeFileSync(
    path.join(DIR, "combined.json"),
    JSON.stringify(combined, null, 2) + "\n"
  );

  const markdown = [
    "# CricZone Traffic Resilience Report",
    "",
    `Generated: ${combined.generatedAt}`,
    "",
    "## Executive summary",
    "",
    `- Scenarios passed: 4/4`,
    `- Total measured requests/attempts: ${totalRequests}`,
    "- Scope: isolated GitHub Actions benchmarks",
    "",
    "## Scenario evidence",
    "",
    "| Infrastructure | Requests/Attempts | Result | CI Evidence |",
    "|---|---:|---|---|",
    ...Object.entries(results).map(([key, value]) =>
      `| ${key} | ${value.requests} | PASS | [Run ${value.ciRunId}](${sourceLink(value.ciRunId)}) |`
    ),
    "",
    "## Important measurements",
    "",
    `- Valkey outage HTTP failures: ${results.valkey.traffic.outage.failures}`,
    `- PostgreSQL outage HTTP 503s: ${results.postgres.traffic.outage.status503}`,
    `- Kafka outage HTTP 503s: ${results.kafka.traffic.outage.unavailable}`,
    `- WebSocket reconnection latency: ${results.websocket.reconnectLatencyMs} ms`,
    `- WebSocket duplicate deliveries: ${results.websocket.duplicateDeliveries}`,
    `- WebSocket baseline client deliveries: ${results.websocket.traffic.delivery.baselineClientDeliveries}`,
    `- WebSocket recovery client deliveries: ${results.websocket.traffic.delivery.recoveryClientDeliveries}`,
    "",
    "## Source report SHA-256 hashes",
    "",
    ...Object.entries(results).map(([key, value]) =>
      `- ${key}: \`${value.sha256}\``
    ),
    "",
    "## Limitations",
    "",
    ...combined.limitations.map(item => `- ${item}`),
    "",
    "## Conclusion",
    "",
    "PASS within the isolated CI benchmark scope.",
    "Production failover and complete end-to-end correctness remain unverified.",
    ""
  ].join("\n");

  fs.writeFileSync(
    path.join(DIR, "combined.md"),
    markdown
  );

  console.log(JSON.stringify({
    passed: true,
    scenarios: combined.passedScenarios,
    totalRequests,
    output: [
      "combined.json",
      "combined.md"
    ]
  }, null, 2));

} catch (error) {
  console.error("Combined validation failed:", error);
  process.exitCode = 1;
}


import fs from "node:fs";
import path from "node:path";

const resultsDir = path.resolve(
    "benchmarks/resilience/postgres/results"
);

const reportsDir = path.resolve(
    "benchmarks/resilience/postgres/reports"
);

fs.mkdirSync(reportsDir, { recursive: true });

function readResult(filename) {
    const filePath = path.join(resultsDir, filename);

    if (!fs.existsSync(filePath)) {
        return {
            status: "NOT_COMPLETED",
            error: `${filename} was not generated`
        };
    }

    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        return {
            status: "INVALID_RESULT",
            error: error.message
        };
    }
}

const baseline = readResult("baseline.json");
const failure = readResult("failure.json");
const recovery = readResult("recovery.json");

const allPassed = [baseline, failure, recovery]
    .every((result) => result.status === "PASSED");

const report = {
    testSuite: "CricZone PostgreSQL Failure and Recovery",
    generatedAt: new Date().toISOString(),

    environment: {
        platform: "GitHub Actions",
        database: "PostgreSQL 16 Alpine",
        nodeVersion: process.version,
        workflowRunId: process.env.GITHUB_RUN_ID ?? null,
        commitSha: process.env.GITHUB_SHA ?? null
    },

    tests: {
        baseline,
        failureDetection: failure,
        applicationRecovery: recovery
    },

    metrics: {
        failureDetectionTimeMs:
            failure.detectionTimeMs ?? null,

        recoveryAttempts:
            recovery.recoveryAttempts ?? null,

        recoveryCheckDurationMs:
            recovery.recoveryCheckDurationMs ?? null,

        restartToQueryRecoveryMs: null
    },

    limitations: [
        "Restart-to-query recovery time was not measured",
        "Existing connection pool recovery was not tested",
        "Committed-record integrity after restart was not independently verified"
    ],

    overallStatus: allPassed ? "PASSED" : "INCOMPLETE_OR_FAILED"
};

const jsonPath = path.join(
    reportsDir,
    "postgres-resilience-report.json"
);

fs.writeFileSync(
    jsonPath,
    JSON.stringify(report, null, 2)
);

const markdown = `# CricZone PostgreSQL Resilience Report

**Generated:** ${report.generatedAt}

**Overall Status:** ${report.overallStatus}

## Environment

- Platform: ${report.environment.platform}
- Database: ${report.environment.database}
- Node.js: ${report.environment.nodeVersion}
- Workflow Run: ${report.environment.workflowRunId ?? "N/A"}
- Commit: ${report.environment.commitSha ?? "N/A"}

## Test Results

| Test | Status |
|---|---|
| Baseline Integrity | ${baseline.status} |
| Failure Detection | ${failure.status} |
| Application Recovery | ${recovery.status} |

## Measurements

| Metric | Result |
|---|---|
| Failure Detection | ${report.metrics.failureDetectionTimeMs ?? "N/A"} ms |
| Recovery Attempts | ${report.metrics.recoveryAttempts ?? "N/A"} |
| Recovery Check Duration | ${report.metrics.recoveryCheckDurationMs ?? "N/A"} ms |
| Restart-to-Query Recovery | Not measured |

## Limitations

${report.limitations.map((item) => `- ${item}`).join("\n")}

## Conclusion

${allPassed
    ? "Baseline integrity, failure detection, and post-restart connectivity verification passed."
    : "One or more required tests did not complete successfully."}
`;

const markdownPath = path.join(
    reportsDir,
    "postgres-resilience-report.md"
);

fs.writeFileSync(markdownPath, markdown);

console.log("PostgreSQL resilience report generated");
console.log(`Overall status: ${report.overallStatus}`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${markdownPath}`);

if (!allPassed) {
    process.exitCode = 1;
}

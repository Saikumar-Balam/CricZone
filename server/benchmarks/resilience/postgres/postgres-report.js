
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(
    "benchmarks/resilience/postgres"
);

const RESULTS_DIR = path.join(ROOT, "results");
const REPORTS_DIR = path.join(ROOT, "reports");

fs.mkdirSync(REPORTS_DIR, { recursive: true });

function readResult(filename) {
    const filenamePath = path.join(
        RESULTS_DIR,
        filename
    );

    if (!fs.existsSync(filenamePath)) {
        return {
            status: "MISSING",
            error: `Missing result: ${filename}`
        };
    }

    try {
        const value = JSON.parse(
            fs.readFileSync(filenamePath, "utf8")
        );

        if (
            !value ||
            typeof value !== "object" ||
            Array.isArray(value)
        ) {
            throw new Error(
                "Expected a JSON object"
            );
        }

        return value;

    } catch (error) {
        return {
            status: "INVALID",
            error: `${filename}: ${error.message}`
        };
    }
}

const baseline = readResult("baseline.json");
const failure = readResult("failure.json");
const recovery = readResult("recovery.json");

const poolFailure = readResult(
    "pool-failure.json"
);

const poolRecovery = readResult(
    "pool-recovery.json"
);

const integrity = readResult(
    "integrity.json"
);

function nonnegative(value) {
    return (
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0
    );
}

function positiveInteger(value) {
    return (
        Number.isSafeInteger(value) &&
        value > 0
    );
}

function validIsoDate(value) {
    return (
        typeof value === "string" &&
        Number.isFinite(Date.parse(value))
    );
}

const checks = {
    baseline:
        baseline.status === "PASSED" &&
        baseline.recordVerified === true &&
        typeof baseline.recordId === "string" &&
        baseline.recordId.length > 0 &&
        baseline.eventType === "BALL_SCORED",

    failureDetection:
        failure.status === "PASSED" &&
        failure.databaseUnhealthy === true &&
        nonnegative(failure.detectionTimeMs),

    applicationRecovery:
        recovery.status === "PASSED" &&
        recovery.connectionRestored === true &&
        positiveInteger(recovery.recoveryAttempts) &&
        nonnegative(recovery.recoveryCheckDurationMs),

    restartToQueryRecovery:
        recovery.status === "PASSED" &&
        nonnegative(recovery.restartToQueryRecoveryMs) &&
        validIsoDate(recovery.restartStartedAt) &&
        validIsoDate(recovery.querySucceededAt) &&
        Date.parse(recovery.querySucceededAt) >=
            Date.parse(recovery.restartStartedAt) &&
        recovery.restartToQueryRecoveryMs ===
            Date.parse(recovery.querySucceededAt) -
            Date.parse(recovery.restartStartedAt),

    existingPoolFailureDetection:
        poolFailure.status === "PASSED" &&
        poolFailure.failureDetected === true,

    existingPoolRecovery:
        poolRecovery.status === "PASSED" &&
        poolRecovery.originalPoolReused === true &&
        poolRecovery.failureDetected === true &&
        poolRecovery.connectionRestored === true &&
        positiveInteger(poolRecovery.recoveryAttempts) &&
        nonnegative(poolRecovery.recoveryDurationMs),

    committedRecordIntegrity:
        integrity.status === "PASSED" &&
        integrity.committedRecordPreserved === true &&
        integrity.recordId === baseline.recordId &&
        integrity.eventType === baseline.eventType &&
        nonnegative(integrity.verificationDurationMs)
};

const failedChecks = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

const metrics = {
    failureDetectionTimeMs:
        failure.detectionTimeMs ?? null,

    recoveryAttempts:
        recovery.recoveryAttempts ?? null,

    recoveryCheckDurationMs:
        recovery.recoveryCheckDurationMs ?? null,

    restartToQueryRecoveryMs:
        recovery.restartToQueryRecoveryMs ?? null,

    existingPoolRecoveryAttempts:
        poolRecovery.recoveryAttempts ?? null,

    existingPoolRecoveryDurationMs:
        poolRecovery.recoveryDurationMs ?? null,

    integrityVerificationDurationMs:
        integrity.verificationDurationMs ?? null
};

const report = {
    testSuite:
        "CricZone PostgreSQL Failure and Recovery",

    generatedAt: new Date().toISOString(),

    environment: {
        platform:
            process.env.GITHUB_ACTIONS === "true"
                ? "GitHub Actions"
                : "Local",

        database: "PostgreSQL 16 Alpine",
        nodeVersion: process.version,

        workflowRunId:
            process.env.GITHUB_RUN_ID ?? null,

        commitSha:
            process.env.GITHUB_SHA ?? null
    },

    tests: {
        baseline,
        failureDetection: failure,
        applicationRecovery: recovery,
        existingPoolFailureDetection: poolFailure,
        existingPoolRecovery: poolRecovery,
        committedRecordIntegrity: integrity
    },

    metrics,
    checks,
    failedChecks,

    overallStatus:
        failedChecks.length === 0
            ? "PASSED"
            : "INCOMPLETE_OR_FAILED"
};

const jsonPath = path.join(
    REPORTS_DIR,
    "postgres-resilience-report.json"
);

const markdownPath = path.join(
    REPORTS_DIR,
    "postgres-resilience-report.md"
);

fs.writeFileSync(
    jsonPath,
    JSON.stringify(report, null, 2),
    "utf8"
);

const markdown = [
    "# CricZone PostgreSQL Resilience Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Overall status: **${report.overallStatus}**`,
    "",
    "## Verification Results",
    "",
    "| Check | Result |",
    "|---|---|",

    ...Object.entries(checks).map(
        ([name, passed]) =>
            `| ${name} | ${passed ? "PASSED" : "FAILED"} |`
    ),

    "",
    "## Metrics",
    "",
    "| Metric | Value |",
    "|---|---|",

    ...Object.entries(metrics).map(
        ([name, value]) =>
            `| ${name} | ${value ?? "Not measured"} |`
    ),

    "",
    "## Failed or Missing Checks",
    "",

    ...(failedChecks.length
        ? failedChecks.map(name => `- ${name}`)
        : ["None"]),

    ""
].join("\n");

fs.writeFileSync(
    markdownPath,
    markdown,
    "utf8"
);

console.log(
    JSON.stringify(
        {
            overallStatus: report.overallStatus,
            checks,
            failedChecks,
            metrics
        },
        null,
        2
    )
);

console.log(
    `JSON report: ${jsonPath}`
);

console.log(
    `Markdown report: ${markdownPath}`
);

if (failedChecks.length > 0) {
    console.error(
        "PostgreSQL resilience report FAILED: " +
        "required checks are missing or invalid"
    );

    process.exitCode = 1;

} else {
    console.log(
        "All PostgreSQL resilience report checks PASSED"
    );
}


import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

const EXPECTED_DATABASE_URL =
    "postgresql://criczone_test:criczone_test@127.0.0.1:55432/criczone_resilience";

const RESULTS_DIR = path.resolve(
    "benchmarks/resilience/postgres/results"
);

const READY_FILE = path.join(RESULTS_DIR, "pool-ready.json");
const FAILURE_FILE = path.join(RESULTS_DIR, "pool-failure.json");
const RECOVERY_FILE = path.join(RESULTS_DIR, "pool-recovery.json");
const RESTART_SIGNAL = path.join(
    RESULTS_DIR,
    "pool-restart-requested"
);

const MAX_WAIT_MS = 35000;
const POLL_INTERVAL_MS = 100;

if (
    process.env.NODE_ENV !== "test" ||
    process.env.DATABASE_URL !== EXPECTED_DATABASE_URL ||
    process.platform !== "linux" ||
    !process.env.GITHUB_ACTIONS
) {
    throw new Error(
        "PostgreSQL orchestration is restricted to isolated GitHub Actions"
    );
}

const containerId = process.env.POSTGRES_CONTAINER_ID;

if (!/^[a-f0-9]{12,64}$/.test(containerId ?? "")) {
    throw new Error("Invalid PostgreSQL container ID");
}

fs.mkdirSync(RESULTS_DIR, { recursive: true });

for (const file of [
    READY_FILE,
    FAILURE_FILE,
    RECOVERY_FILE,
    RESTART_SIGNAL
]) {
    fs.rmSync(file, { force: true });
}

function docker(args) {
    const result = spawnSync("docker", args, {
        encoding: "utf8",
        timeout: 20000
    });

    if (result.error || result.status !== 0) {
        throw new Error(
            `Docker command failed: ${result.stderr || result.error?.message}`
        );
    }

    return result.stdout.trim();
}

async function waitForFile(file, child, timeoutMs = MAX_WAIT_MS) {
    const start = performance.now();

    while (performance.now() - start < timeoutMs) {
        if (child.exitCode !== null) {
            throw new Error(
                `Pool test exited prematurely with code ${child.exitCode}`
            );
        }

        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, "utf8"));
        }

        await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
        `Timed out waiting for ${path.basename(file)}`
    );
}

function runNodeScript(filename, extraEnv = {}) {
    const result = spawnSync(
        process.execPath,
        [path.join(
            "benchmarks/resilience/postgres",
            filename
        )],
        {
            stdio: "inherit",
            env: {
                ...process.env,
                ...extraEnv
            },
            timeout: 40000
        }
    );

    if (result.error || result.status !== 0) {
        throw new Error(`${filename} failed`);
    }
}

let child = null;
let postgresStopped = false;

try {
    console.log("Starting PostgreSQL pool recovery test");

    child = spawn(
        process.execPath,
        [
            path.join(
                "benchmarks/resilience/postgres",
                "postgres-pool-recovery.js"
            )
        ],
        {
            stdio: "inherit",
            env: process.env
        }
    );

    const ready = await waitForFile(READY_FILE, child);

    if (ready.status !== "READY") {
        throw new Error("Pool initialization failed");
    }

    console.log("Original PostgreSQL pool is ready");

    // Stop PostgreSQL while original pool remains alive

    docker(["stop", "--timeout", "5", containerId]);
    postgresStopped = true;

    if (
        docker([
            "inspect",
            "--format",
            "{{.State.Running}}",
            containerId
        ]) !== "false"
    ) {
        throw new Error("PostgreSQL did not stop");
    }

    const failure = await waitForFile(FAILURE_FILE, child);

    if (
        failure.status !== "PASSED" ||
        failure.failureDetected !== true
    ) {
        throw new Error("Original pool failed to detect outage");
    }

    console.log("Original pool detected database outage");

    // Run existing failure detection test

    runNodeScript("postgres-failure.js");

    // Record restart timestamp immediately before docker start

    const restartStartedAtMs = Date.now();

    postgresStopped = true;

    docker(["start", containerId]);

    postgresStopped = false;

    console.log("PostgreSQL restart requested");

    fs.writeFileSync(RESTART_SIGNAL, "restart-requested");

    // Verify new application connection recovery

    runNodeScript("postgres-recovery.js", {
        POSTGRES_RESTART_STARTED_AT_MS:
            String(restartStartedAtMs)
    });

    // Verify the original connection pool recovers

    const poolRecovery = await waitForFile(
        RECOVERY_FILE,
        child
    );

    if (
        poolRecovery.status !== "PASSED" ||
        poolRecovery.originalPoolReused !== true ||
        poolRecovery.connectionRestored !== true
    ) {
        throw new Error("Existing PostgreSQL pool recovery failed");
    }

    console.log("PostgreSQL existing pool recovery PASSED");

} finally {
    if (postgresStopped) {
        try {
            docker(["start", containerId]);
        } catch (error) {
            console.error(
                "PostgreSQL cleanup restart failed:",
                error.message
            );
        }
    }

    if (child && child.exitCode === null) {
        child.kill("SIGTERM");
    }
}

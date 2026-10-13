
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
    process.env.GITHUB_ACTIONS !== "true"
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

// Remove stale synchronization files before starting.
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
            `Docker command failed: ${
                result.stderr ||
                result.error?.message ||
                `Exit code ${result.status}`
            }`
        );
    }

    return result.stdout.trim();
}

// Wait for a synchronization/result file.
// A successful child exit is acceptable if the file exists.
async function waitForFile(
    file,
    child,
    timeoutMs = MAX_WAIT_MS
) {
    const start = performance.now();

    while (performance.now() - start < timeoutMs) {
        // Check for the result before checking child exit status.
        if (fs.existsSync(file)) {
            let result;

            try {
                result = JSON.parse(
                    fs.readFileSync(file, "utf8")
                );
            } catch (error) {
                throw new Error(
                    `Invalid result file ${path.basename(file)}: ${error.message}`
                );
            }

            if (
                child.exitCode !== null &&
                child.exitCode !== 0
            ) {
                throw new Error(
                    `Pool test failed with exit code ${child.exitCode}`
                );
            }

            if (child.signalCode !== null) {
                throw new Error(
                    `Pool test terminated by signal ${child.signalCode}`
                );
            }

            return result;
        }

        // The child must produce the expected file before exiting.
        if (child.exitCode !== null) {
            throw new Error(
                `Pool test exited before producing ${path.basename(file)}. ` +
                `Exit code: ${child.exitCode}`
            );
        }

        if (child.signalCode !== null) {
            throw new Error(
                `Pool test terminated by signal ${child.signalCode}`
            );
        }

        await sleep(POLL_INTERVAL_MS);
    }

    throw new Error(
        `Timed out waiting for ${path.basename(file)}`
    );
}

// Execute an existing resilience script and require success.
function runNodeScript(filename, extraEnv = {}) {
    const scriptPath = path.join(
        "benchmarks/resilience/postgres",
        filename
    );

    const result = spawnSync(
        process.execPath,
        [scriptPath],
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
        throw new Error(
            `${filename} failed: ${
                result.error?.message ||
                `Exit code ${result.status}`
            }`
        );
    }
}

// Wait for the persistent pool process to finish.
// A valid result file alone is not sufficient.
async function waitForSuccessfulExit(child) {
    const exitCode = await new Promise(
        (resolve, reject) => {
            if (child.exitCode !== null) {
                resolve(child.exitCode);
                return;
            }

            if (child.signalCode !== null) {
                reject(
                    new Error(
                        `Pool process terminated by ${child.signalCode}`
                    )
                );
                return;
            }

            const onExit = (code, signal) => {
                child.removeListener("error", onError);

                if (signal) {
                    reject(
                        new Error(
                            `Pool process terminated by ${signal}`
                        )
                    );
                    return;
                }

                resolve(code);
            };

            const onError = (error) => {
                child.removeListener("exit", onExit);
                reject(error);
            };

            child.once("exit", onExit);
            child.once("error", onError);
        }
    );

    if (exitCode !== 0) {
        throw new Error(
            `Pool recovery process failed with exit code ${exitCode}`
        );
    }

    console.log(
        "Persistent PostgreSQL pool process exited successfully"
    );
}

let child = null;
let postgresStopped = false;

try {
    // 1. Start persistent pool test process.

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

    // 2. Wait until the original connection pool is ready.

    const ready = await waitForFile(
        READY_FILE,
        child
    );

    if (
        ready.status !== "READY" ||
        ready.originalPoolEstablished !== true
    ) {
        throw new Error(
            "Original PostgreSQL pool initialization failed"
        );
    }

    console.log("Original PostgreSQL pool is ready");

    // 3. Stop PostgreSQL while the original pool remains alive.

    console.log("Stopping PostgreSQL service container");

    // Set before invoking docker stop so cleanup can recover
    // even if the Docker command fails after stopping the DB.
    postgresStopped = true;

    docker([
        "stop",
        "--timeout",
        "5",
        containerId
    ]);

    const stoppedStatus = docker([
        "inspect",
        "--format",
        "{{.State.Running}}",
        containerId
    ]);

    if (stoppedStatus !== "false") {
        throw new Error(
            "PostgreSQL is unexpectedly still running"
        );
    }

    console.log("PostgreSQL outage confirmed");

    // 4. Verify the original pool detects the outage.

    const failure = await waitForFile(
        FAILURE_FILE,
        child
    );

    if (
        failure.status !== "PASSED" ||
        failure.failureDetected !== true
    ) {
        throw new Error(
            "Original PostgreSQL pool failed to detect outage"
        );
    }

    console.log(
        "Original PostgreSQL pool detected database outage"
    );

    // 5. Run the existing application failure detection test.

    runNodeScript("postgres-failure.js");

    // 6. Restart PostgreSQL and record the start timestamp.

    const restartStartedAtMs = Date.now();

    console.log("Restarting PostgreSQL service container");

    docker([
        "start",
        containerId
    ]);

    postgresStopped = false;

    console.log("PostgreSQL restart requested");

    // 7. Signal the persistent pool process to verify recovery.

    fs.writeFileSync(
        RESTART_SIGNAL,
        "restart-requested",
        "utf8"
    );

    // 8. Verify application recovery with a fresh client.

    runNodeScript(
        "postgres-recovery.js",
        {
            POSTGRES_RESTART_STARTED_AT_MS:
                String(restartStartedAtMs)
        }
    );

    // 9. Verify recovery using the original connection pool.

    const poolRecovery = await waitForFile(
        RECOVERY_FILE,
        child
    );

    if (
        poolRecovery.status !== "PASSED" ||
        poolRecovery.originalPoolReused !== true ||
        poolRecovery.failureDetected !== true ||
        poolRecovery.connectionRestored !== true
    ) {
        throw new Error(
            "Existing PostgreSQL connection pool recovery failed"
        );
    }

    console.log(
        "PostgreSQL existing connection pool recovery PASSED"
    );

    // 10. Verify the persistent pool process exits successfully.

    await waitForSuccessfulExit(child);

    console.log(
        "PostgreSQL failure and recovery orchestration PASSED"
    );

} finally {
    // 11. Restore PostgreSQL if an earlier test left it stopped.

    if (postgresStopped) {
        try {
            console.log(
                "Restoring PostgreSQL during cleanup"
            );

            docker([
                "start",
                containerId
            ]);

            console.log(
                "PostgreSQL cleanup restart completed"
            );
        } catch (error) {
            console.error(
                "PostgreSQL cleanup restart failed:",
                error.message
            );
        }
    }

    // 12. Stop the child only if it is still running.
    // Successful child processes are not terminated.

    if (
        child &&
        child.exitCode === null &&
        child.signalCode === null
    ) {
        child.kill("SIGTERM");
    }
}

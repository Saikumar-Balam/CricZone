
import fs from "node:fs/promises";
import path from "node:path";

export default class WebSocketReporter {
    constructor(outputDirectory) {
        this.outputDirectory = outputDirectory;
    }

    percentile(values, percentile) {
        if (!values.length) return null;

        const sorted = [...values].sort((a, b) => a - b);

        const index = Math.ceil(
            (percentile / 100) * sorted.length
        ) - 1;

        return sorted[
            Math.max(0, Math.min(index, sorted.length - 1))
        ];
    }

    summarizeLatencies(values) {
        return {
            samples: values.length,
            p50Ms: this.percentile(values, 50),
            p95Ms: this.percentile(values, 95),
            p99Ms: this.percentile(values, 99),
            maxMs: values.length ? Math.max(...values) : null
        };
    }

    async save(name, results) {
        await fs.mkdir(this.outputDirectory, {
            recursive: true
        });

        const filename = path.join(
            this.outputDirectory,
            `${name}.json`
        );

        await fs.writeFile(
            filename,
            JSON.stringify(results, null, 2),
            "utf8"
        );

        console.log(`Report saved: ${filename}`);
    }
}

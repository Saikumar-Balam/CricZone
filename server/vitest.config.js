import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",

        coverage: {
            provider: "v8",
            reporter: [
                "text",
                "html"
            ]
        }
    }
})

// It uses V8's coverage capabilities to determine which production code was executed by tests.
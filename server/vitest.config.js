import { defineConfig } from "vitest/config";

export default defineConfig({

    test: {

        environment: "node",

        setupFiles: [
            "./tests/setup.js"
        ],

        testTimeout: 20000,

        coverage: {

            provider: "v8",

            reporter: [
                "text",
                "html"
            ],

            include: [
                "src/**/*.js"
            ],

            exclude: [
                "src/**/contracts/**",
                "src/containers/**",
                "src/config/**",
                "src/**/*.container.js",
                "src/app.js",
                "src/server.js"
            ],

            thresholds: {
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70
            }
        }
    }
});
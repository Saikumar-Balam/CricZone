import {
    beforeEach,
    describe,
    expect,
    it
} from "vitest";

import PrometheusMetrics
    from "../../../src/observability/metrics/PrometheusMetrics.js";


describe("PrometheusMetrics", () => {

    let metrics;

    beforeEach(() => {
        metrics = new PrometheusMetrics();
    });


    it("should initialize registry and metric collections", () => {

        expect(metrics.registry).toBeDefined();

        expect(metrics.counters)
            .toBeInstanceOf(Map);

        expect(metrics.gauges)
            .toBeInstanceOf(Map);

        expect(metrics.histograms)
            .toBeInstanceOf(Map);
    });


    it("should create and increment a counter", async () => {

        metrics.incrementCounter(
            "test_requests_total",
            1,
            {
                method: "GET"
            }
        );

        expect(
            metrics.counters.has(
                "test_requests_total"
            )
        ).toBe(true);

        const output = await metrics.getMetrics();

        expect(output)
            .toContain("test_requests_total");

        expect(output)
            .toContain('method="GET"');
    });


    it("should reuse an existing counter", () => {

        metrics.incrementCounter(
            "test_reused_counter_total",
            1
        );

        const firstCounter =
            metrics.counters.get(
                "test_reused_counter_total"
            );

        metrics.incrementCounter(
            "test_reused_counter_total",
            2
        );

        const secondCounter =
            metrics.counters.get(
                "test_reused_counter_total"
            );

        expect(secondCounter)
            .toBe(firstCounter);

        expect(metrics.counters.size)
            .toBe(1);
    });


    it("should create and set a gauge", async () => {

        metrics.setGauge(
            "test_active_connections",
            5,
            {
                service: "websocket"
            }
        );

        expect(
            metrics.gauges.has(
                "test_active_connections"
            )
        ).toBe(true);

        const output = await metrics.getMetrics();

        expect(output)
            .toContain(
                "test_active_connections"
            );

        expect(output)
            .toContain(
                'service="websocket"'
            );
    });


    it("should reuse an existing gauge", () => {

        metrics.setGauge(
            "test_queue_size",
            5
        );

        const firstGauge =
            metrics.gauges.get(
                "test_queue_size"
            );

        metrics.setGauge(
            "test_queue_size",
            10
        );

        const secondGauge =
            metrics.gauges.get(
                "test_queue_size"
            );

        expect(secondGauge)
            .toBe(firstGauge);

        expect(metrics.gauges.size)
            .toBe(1);
    });


    it("should create and observe a histogram", async () => {

        metrics.observeHistogram(
            "test_request_duration_ms",
            150,
            {
                method: "GET"
            }
        );

        expect(
            metrics.histograms.has(
                "test_request_duration_ms"
            )
        ).toBe(true);

        const output = await metrics.getMetrics();

        expect(output)
            .toContain(
                "test_request_duration_ms"
            );

        expect(output)
            .toContain('method="GET"');
    });


    it("should reuse an existing histogram", () => {

        metrics.observeHistogram(
            "test_processing_duration_ms",
            100
        );

        const firstHistogram =
            metrics.histograms.get(
                "test_processing_duration_ms"
            );

        metrics.observeHistogram(
            "test_processing_duration_ms",
            200
        );

        const secondHistogram =
            metrics.histograms.get(
                "test_processing_duration_ms"
            );

        expect(secondHistogram)
            .toBe(firstHistogram);

        expect(metrics.histograms.size)
            .toBe(1);
    });


    it("should return Prometheus metrics output", async () => {

        metrics.incrementCounter(
            "test_metrics_output_total"
        );

        const output =
            await metrics.getMetrics();

        expect(typeof output)
            .toBe("string");

        expect(output)
            .toContain(
                "test_metrics_output_total"
            );
    });


    it("should return registry content type", () => {

        const contentType =
            metrics.getContentType();

        expect(contentType)
            .toBe(metrics.registry.contentType);

        expect(typeof contentType)
            .toBe("string");
    });

});

// Abstraction — tests behavior through the public Metrics implementation API.
// Encapsulation — private #getOrCreate... methods are not tested directly.
// SRP — tests only metrics collection responsibilities.
// OCP — Prometheus remains one replaceable metrics implementation.
// LSP — PrometheusMetrics fulfills the Metrics contract.
// DIP — higher-level CricZone components can depend on the Metrics abstraction.
// Testability — public behavior indirectly verifies private implementation paths.
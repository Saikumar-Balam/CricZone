import {Counter, Gauge, Histogram, Registry, collectDefaultMetrics} from "@prometheus-io/client"
import Metrics from "../contracts/Metrics.js";

export default class PrometheusMetrics extends Metrics
{
    constructor()
    {
        super()
        this.registry = new Registry()
        this.counters = new Map()
        this.gauges = new Map()
        this.histograms = new Map()
        collectDefaultMetrics({
            register: this.registry,
            prefix: "criczone_"
        })
    }

    incrementCounter(name, value = 1, labels = {})
    {
        // # for private method in js
        const counter = this.#getOrCreateCounter(name, labels)
        counter.inc(labels, value)
    }

    setGauge(name, value, labels = {})
    {
        const gauge = this.#getOrCreateGauge(name, labels)
        gauge.set(labels, value)
    }

    observeHistogram(name, value, labels = {})
    {
        const histogram = this.#getOrCreateHistogram(name, labels)
        histogram.observe(labels, value)
    }

    async getMetrics()
    {
        return this.registry.metrics()
    }

    getContentType()
    {
        return this.registry.contentType
    }

    #getOrCreateCounter(name, labels)
    {
        if(!this.counters.has(name))
        {
            const counter = new Counter({name, 
                help: `${name} counter`,
                labelNames: Object.keys(labels),
                registers: [this.registry]
            })
            this.counters.set(name, counter)
        }
        return this.counters.get(name)          
    }

    #getOrCreateGauge(name, labels)
    {
        if(!this.gauges.has(name))
        {
            const gauge = new Gauge({name, 
                help: `${name} gauge`,
                labelNames: Object.keys(labels),
                registers: [this.registry]
            })
            this.gauges.set(name, gauge)
        }
        return this.gauges.get(name)
    }

    #getOrCreateHistogram(name, labels)
    {
        if(!this.histograms.has(name))
        {
            const histogram = new Histogram({name,
                help: `${name} gauge`,
                labelNames: Object.keys(labels),
                registers: [this.registry]
            })
            this.histograms.set(name, histogram)
        }
        return this.histograms.get(name)
    }
}
// collectDefaultMetrics() gives us useful Node.js/process metrics such as event-loop behavior, memory/process information, active handles, GC-related metrics, and Node.js version information. These metrics are collected when the registry is scraped.

// lld
// Abstraction — Metrics defines the contract without implementation details.
// DIP (Dependency Inversion Principle) — higher-level modules depend on Metrics, not directly on Prometheus.
// LSP (Liskov Substitution Principle) — PrometheusMetrics or another implementation can substitute Metrics.
// OCP (Open/Closed Principle) — new metrics implementations can be added without changing existing business logic.
// SRP (Single Responsibility Principle) — Metrics is responsible only for defining metrics operations.
// Dependency Injection (DI) — the concrete metrics implementation is injected into services/components that need it.
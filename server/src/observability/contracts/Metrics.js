export default class Metrics {
    incrementCounter(name, value = 1, labels = {})
    {
        throw new Error("incrementCounter() must be implemented")
    }

    setGauge(name, value, lables = {})
    {
        throw new Error("setGauge() must be implemented")
    }

    observeHistogram(name, value, labels = {})
    {
        throw new Error("observeHistogram() must be implemented")
    }

    async getMetrics()
    {
        throw new Error("getMetrics() mustv be implemented")
    }

    getContentType()
    {
        throw new Error("getContentType() must be implemented")
    }
}

//lld
// DIP
// → business code depends on Metrics abstraction

// OCP
// → new metrics backend can be added without modifying services

// SRP
// → Metrics handles metric recording only

// DI
// → concrete Metrics implementation injected from container

// LSP
// → any implementation satisfying Metrics can replace another
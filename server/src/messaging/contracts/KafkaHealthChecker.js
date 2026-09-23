export default class KafkaHealthChecker {
    async check()
    {
        throw new Error("check() must be implemented")
    }
}

// SRP — Kafka health checking has its own responsibility.
// DIP — readiness logic can depend on a health-check abstraction.
// DI — concrete Kafka health checker will be injected.
// Interface Segregation — readiness doesn't need producer/consumer APIs just to check Kafka.
// Open/Closed Principle — Kafka health implementation can change without changing the readiness controller.
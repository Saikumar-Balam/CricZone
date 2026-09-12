export default class HealthService {
    constructor(databaseClient, redisClient, kafkaProducer)
    {
        this.databaseClient = databaseClient
        this.redisClient = redisClient
        this.kafkaProducer = kafkaProducer
    }

    async checkReadiness()
    {
        const checks = {
            database: false,
            redis: false,
            kafka: false
        }
        try{
            await this.databaseClient.query("select 1")
            checks.database = true
        }
        catch{
            checks.database = false 
        }

        try {
            await this.redisClient.ping()
            checks.redis = true 
        }
        catch {
            checks.redis = false
        }

        try {
            checks.kafka = this.kafkaProducer != null
        }
        catch 
        {
            checks.kafka = false
        }

        const ready = Object.values(checks).every(Boolean)

        return {
            ready, 
            checks
        }
    }
}

// SRP
// HealthService is responsible only for checking
// application dependency readiness.

// DI
// databaseClient, redisClient, and kafkaProducer
// are injected through the constructor.

// DIP
// HealthService depends on injected dependency clients
// instead of creating PostgreSQL, Redis, or Kafka clients itself.

// Separation of Concerns
// Readiness logic is kept outside controllers,
// routes, and app.js.

// Encapsulation
// Dependency-checking logic is contained
// inside checkReadiness().

// OCP
// More dependency checks can be added later
// without changing the controller.

// Testability
// Database, Redis, and Kafka dependencies
// can be mocked independently in unit tests.
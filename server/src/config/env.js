const REQUIRED_ENV = {
    development: [
        "DATABASE_URL",
        "REDIS_URL",
        "KAFKA_CLIENT_ID",
        "KAFKA_BROKERS",
        "KAFKA_USERNAME",
        "KAFKA_PASSWORD",
        "KAFKA_CA_PATH",
        "KAFKA_LIVE_CONSUMER_GROUP",
        "CORS_ALLOWED_ORIGINS"
    ],

    test: [
        "TEST_DATABASE_URL",
        "TEST_REDIS_URL",
        "TEST_KAFKA_BROKERS",
        "TEST_KAFKA_TOPIC",
        "TEST_KAFKA_CA_PATH",
        "TEST_KAFKA_USERNAME",
        "TEST_KAFKA_PASSWORD",
        "TEST_CORS_ALLOWED_ORIGINS"
    ],

    production: [
        "DATABASE_URL",
        "REDIS_URL",
        "KAFKA_CLIENT_ID",
        "KAFKA_BROKERS",
        "KAFKA_USERNAME",
        "KAFKA_PASSWORD",
        "KAFKA_CA_PATH",
        "KAFKA_LIVE_CONSUMER_GROUP",
        "CORS_ALLOWED_ORIGINS"
    ]
}

function isMissing(value)
{
    return ( value === undefined || value === null || String(value).trim() === "")
}

function validateProductionSecurity(env)
{
    // Redis / Valkey must use TLS
    if(!env.REDIS_URL.startsWith("rediss://"))
    {
        throw new Error("Production REDIS_URL must use TLS (redis://)")
    }
    // Kafka Brokers must be configured
    const brokers = env.KAFKA_BROKERS.split(",").map((broker) => broker.trim()).filter(Boolean)
    if(brokers.length === 0)
    {
        throw new Error("Production Kafka requires at least one broker")
    }
    // Kafka TLS CA certificate must be configured
    if(!env.KAFKA_CA_PATH.trim())
    {
        throw new Error("Production Kafka requires a TLS CA certificate")
    }

    // Kafka SASl credentials must be configured
    if(!env.KAFKA_USERNAME.trim() || !env.KAFKA_PASSWORD.trim())
    {
        throw new Error("Production Kafka requires SASL credentials")
    }
}

export function validateEnvironment(env = process.env)
{
    const nodeEnv = env.NODE_ENV || "development"
    const requiredVariables = REQUIRED_ENV[nodeEnv]
    if(!requiredVariables)
    {
        throw new Error(`Unsupported NODE_ENV: ${nodeEnv}`)
    }

    const missingVariables = requiredVariables.filter((name) => isMissing(env[name]))
    if(missingVariables.length > 0)
    {
        throw new Error(`Missing required environment variables for ${nodeEnv}: ${missingVariables.join(", ")}`)
    }
    if(nodeEnv === "production")
    {
        validateProductionSecurity(env)
    }
    return {
        nodeEnv, 
        port: Number(env.PORT || 5000)
    }
}

// SRP — validateEnvironment() only validates environment configuration.
// DIP — env is injectable instead of forcing direct process.env access, which makes testing easy.
// Encapsulation — environment requirements are centralized.
// DRY — one validator handles development, test and production.
// Fail Fast — missing mandatory configuration is detected before application startup.
// Testability — tests can pass fake environment objects without modifying the real process environment.
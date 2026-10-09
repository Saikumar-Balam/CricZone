
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
        "TEST_CORS_ALLOWED_ORIGINS"
    ],

    production: [
        "DATABASE_URL",
        "REDIS_URL",
        "KAFKA_CLIENT_ID",
        "KAFKA_BROKERS",
        "KAFKA_USERNAME",
        "KAFKA_PASSWORD",
        "KAFKA_CA",
        "KAFKA_LIVE_CONSUMER_GROUP",
        "CORS_ALLOWED_ORIGINS"
    ]
};


function isMissing(value) {
    return (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
    );
}


function isLocalKafka(brokers) {
    return brokers.length > 0 &&
        brokers.every((broker) =>
            /^(localhost|127\.0\.0\.1):\d+$/.test(broker)
        );
}


function validateTestKafkaSecurity(env) {
    const brokers = env.TEST_KAFKA_BROKERS
        .split(",")
        .map((broker) => broker.trim())
        .filter(Boolean);

    if (brokers.length === 0) {
        throw new Error(
            "Test Kafka requires at least one broker"
        );
    }

    if (isLocalKafka(brokers)) {
        return;
    }

    const requiredSecurityVariables = [
        "TEST_KAFKA_CA_PATH",
        "TEST_KAFKA_USERNAME",
        "TEST_KAFKA_PASSWORD"
    ];

    const missingVariables =
        requiredSecurityVariables.filter((name) =>
            isMissing(env[name])
        );

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing required Kafka security variables for test: ${missingVariables.join(", ")}`
        );
    }
}


function validateProductionSecurity(env) {
    // Redis / Valkey must use TLS
    if (!env.REDIS_URL.startsWith("rediss://")) {
        throw new Error(
            "Production REDIS_URL must use TLS (rediss://)"
        );
    }

    // Kafka brokers must be configured
    const brokers = env.KAFKA_BROKERS
        .split(",")
        .map((broker) => broker.trim())
        .filter(Boolean);

    if (brokers.length === 0) {
        throw new Error(
            "Production Kafka requires at least one broker"
        );
    }

    // Kafka TLS CA certificate must be configured
    if (!env.KAFKA_CA.trim()) {
        throw new Error(
            "Production Kafka requires a TLS CA certificate"
        );
    }

    // Kafka SASL credentials must be configured
    if (
        !env.KAFKA_USERNAME.trim() ||
        !env.KAFKA_PASSWORD.trim()
    ) {
        throw new Error(
            "Production Kafka requires SASL credentials"
        );
    }
}


export function validateEnvironment(env = process.env) {
    const nodeEnv = env.NODE_ENV || "development";

    const requiredVariables = REQUIRED_ENV[nodeEnv];

    if (!requiredVariables) {
        throw new Error(
            `Unsupported NODE_ENV: ${nodeEnv}`
        );
    }

    const missingVariables = requiredVariables.filter(
        (name) => isMissing(env[name])
    );

    if (missingVariables.length > 0) {
        throw new Error(
            `Missing required environment variables for ${nodeEnv}: ${missingVariables.join(", ")}`
        );
    }

    if (nodeEnv === "production") {
        validateProductionSecurity(env);
    }

    if (nodeEnv === "test") {
        validateTestKafkaSecurity(env);
    }

    const corsAllowedOrigins = (
        nodeEnv === "test"
            ? env.TEST_CORS_ALLOWED_ORIGINS
            : env.CORS_ALLOWED_ORIGINS
    )
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    return {
        nodeEnv,
        port: Number(env.PORT || 5000),
        redisUrl:
            nodeEnv === "test"
                ? env.TEST_REDIS_URL
                : env.REDIS_URL,
        corsAllowedOrigins
    };
}


// LLD Principles:
//
// SRP: Environment validation is separated from infrastructure.
//
// DIP: Environment variables are injectable for testing.
//
// Encapsulation: Validation rules are centralized.
//
// DRY: Shared validation logic is reused.
//
// Fail Fast: Missing configuration causes immediate failure.
//
// Security: Production always requires TLS and SASL.
//
// Testability: Local Kafka CI runs without TLS credentials.

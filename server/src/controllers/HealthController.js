export default class HealthController 
{
    constructor(healthService)
    {
        this.healthService = healthService
        this.health = this.health.bind(this)
        this.readiness = this.readiness.bind(this)
    }

    health(req, res) {
        return res.status(200).json({
            status: "UP",
            service: "CricZone API"
        })
    }

    async readiness(req, res, next) 
    {
        try{
            const result = await this.healthService.checkReadiness()
            const statusCode = result.ready ? 200 : 503

            return res.status(statusCode).json({
                status: result.ready ? "READY" : "NOT_READY",
                service: "CricZone API",
                dependencies: result.checks
            })
        }
        catch(error)
        {
            next(error)
        }
    }
}

// SRP
// HealthController is responsible only for
// handling health/readiness HTTP requests and responses.

// DI
// HealthService is injected through the constructor.

// DIP
// HealthController depends on the HealthService abstraction/behavior
// instead of creating dependency-checking logic itself.

// Separation of Concerns
// HTTP handling stays in the controller,
// while readiness checks stay in HealthService.

// Delegation
// The controller delegates readiness evaluation
// to healthService.checkReadiness().

// Encapsulation
// Health/readiness HTTP behavior is contained
// inside the controller methods.

// Testability
// HealthService can be mocked while testing
// controller responses for READY / NOT_READY states.
import express from "express"

export default function createHealthRouter(healthController)
{
    const router = express.Router()
    router.get("/health", healthController.health)

    router.get("/ready", healthController.readiness)
    return router
}
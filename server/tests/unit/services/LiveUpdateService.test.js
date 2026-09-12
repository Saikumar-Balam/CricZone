import { describe, it, expect, vi, beforeEach, recordArtifact } from "vitest";
import LiveUpdateService from "../../../src/services/LiveUpdateService.js"

describe("Live Update Service", () => {
    let scorecardRepository
    let cache
    let webSocketGateway
    let logger
    let metrics
    let service
    let event
    let repositoryResult

    beforeEach(() => {
        scorecardRepository = {
            recordBall: vi.fn()
        }
        cache = {
            setLiveState: vi.fn(),
            invalidateScorecard: vi.fn(),
            invalidateSummary: vi.fn(),
            appendCommentary: vi.fn(),
            promoteCompletedMatch: vi.fn()
        }

        webSocketGateway = {
            emitToRoom: vi.fn()
        }
        logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        }
        metrics = {
            incrementCounter: vi.fn()
        }
        service = new LiveUpdateService(scorecardRepository, cache, webSocketGateway, logger, metrics)
        event = {
            eventId: "550e8400-e29b-41d4-a716-446655440000",
            type: "BALL_RECORDED",
            traceId:"trace-123",
            payload: {
                matchId:"660e8400-e29b-41d4-a716-446655440000",
                inningsId: "770e8400-e29b-41d4-a716-446655440000",
                inningsNumber: 1
            }
        }

        repositoryResult = {
            duplicate: false,

            updatedInnings: {
                total_runs: 104,
                wickets: 3,
                legal_balls:62,
                extras: 6
            },
            delivery: {
                id: "delivery-1",
                over_Number: 10,
                ball_Number: 3,
                batsman_runs: 4,
                extra_runs: 0,
                total_runs: 4,
                is_wicket: false,
                is_four: false,
                is_six: false
            },

            commentaryEvent: {
                type: "COMMENTARY",
                text: "FOUR!"
            },
            overSummaryEvent: null,
            milestoneEvents: [],
            inningsEndEvent: null,
            inningsCompleted: false,
            completionReason: null
        }
    })

    it("should successfully process a ball recorded event", async() => {
        // Arrange
        scorecardRepository.recordBall.mockResolvedValue(repositoryResult)
        // Act
        const result = await service.processBallRecorded(event)
        // Assert
        expect(scorecardRepository.recordBall).toHaveBeenCalledWith(event.eventId, event.payload)
        expect(metrics.incrementCounter).toHaveBeenCalledWith("ball_events_processed_total", 1, {
            event_type: "BALL_RECORDED"
        })
        expect(cache.setLiveState).toHaveBeenCalledTimes(1)
        expect(webSocketGateway.emitToRoom).toHaveBeenCalledTimes(1)
        expect(result).toEqual(repositoryResult)
    })

    it("should ignore duplicate ball event", async () => {
        // Arrange
        const duplicateResult = {
            duplicate: true
        }
        scorecardRepository.recordBall.mockResolvedValue(duplicateResult)
        // Act
        const result = await service.processBallRecorded(event)
        // Assert
        expect(metrics.incrementCounter).toHaveBeenCalledWith("duplicate_ball_events_total", 1, {
            event_type: "BALL_RECORDED"
        })

        expect(logger.warn).toHaveBeenCalledWith("Duplicate BALL_RECORDED event ignored", 
            expect.objectContaining({
                eventId: event.eventId,
                matchId: event.payload.matchId
            })
        )
        expect(cache.setLiveState).not.toHaveBeenCalled()
        expect(webSocketGateway.emitToRoom).not.toHaveBeenCalled()
        expect(result).toEqual(duplicateResult)
    })

    it("should update redis successfully", async () => {
        scorecardRepository.recordBall.mockResolvedValue(repositoryResult)
        await service.processBallRecorded(event)
        expect(cache.setLiveState).toHaveBeenCalledWith(event.payload.matchId,expect.objectContaining({
            matchId: event.payload.matchId,
            inningsId: event.payload.inningsId,
            inningsNumber: 1,
            score: {
                runs: 104,
                wickets: 3,
                legalBalls:62,
                extras: 6
            }
        }))
        expect(cache.invalidateScorecard).toHaveBeenCalledWith(event.payload.matchId)
        expect(cache.invalidateSummary).toHaveBeenCalledWith(event.payload.matchId)
        expect(cache.appendCommentary).toHaveBeenCalledWith(event.payload.matchId, repositoryResult.commentaryEvent)
    })

    it("should continue processing when redis fails", async () => {
        // Arrange
        scorecardRepository.recordBall.mockResolvedValue(repositoryResult)
        const redisError = new Error("Redis unavailable")
        cache.setLiveState.mockRejectedValue(redisError)
        // Act
        const result = await service.processBallRecorded(event)
        // Assert
        expect(metrics.incrementCounter).toHaveBeenCalledWith("live_update_failures_total", 1, {
            stage: "redis"
        })
        expect(logger.error).toHaveBeenCalledWith("Redis live cache update failed", expect.objectContaining({
            eventId: event.eventId,
            error: "Redis unavailable"
        }))
        expect(webSocketGateway.emitToRoom).toHaveBeenCalledTimes(1)
        expect(result).toEqual(repositoryResult)
    })

    it("should publish live update through WebSocket", async() => {
        scorecardRepository.recordBall.mockResolvedValue(repositoryResult)
        await service.processBallRecorded(event)
        expect(webSocketGateway.emitToRoom).toHaveBeenCalledWith(`match:${event.payload.matchId}`, "BALL_RECORDED",
            expect.objectContaining({
                matchId: event.payload.matchId,
                score: {
                    runs: 104,
                    wickets: 3,
                    legalBalls: 62,
                    extras: 6
                },
                inningsCompleted: false
            })
        )
    })

    it("should handle WbeSocket failure without failing processing", async() => {
        // Arrange
        scorecardRepository.recordBall.mockResolvedValue(repositoryResult)
        const webSocketError = new Error("Socket emission failed")

        webSocketGateway.emitToRoom.mockImplementation(() =>{
            throw webSocketError
        })
        // Act
        const result = await service.processBallRecorded(event)
        // Assert
        expect(metrics.incrementCounter).toHaveBeenCalledWith("live_update_failures_total", 1, {
            stage: "websocket"
        })
        expect(logger.error).toHaveBeenCalledWith("WebSocket live update failed", expect.objectContaining({
            eventId: event.eventId,
            error: "Socket emission failed"
        }))
        expect(result).toEqual(repositoryResult)
    })

    it("should increment processed event metric", async() => {
        scorecardRepository.recordBall.mockResolvedValue(repositoryResult)
        await service.processBallRecorded(event)
        expect(metrics.incrementCounter).toHaveBeenCalledWith("ball_events_processed_total", 1, {
            event_type: "BALL_RECORDED"
        })
    })

    it("should not update cache or WebSocket or duplicate event", async () => {
        scorecardRepository.recordBall.mockResolvedValue({
            duplicate: true
        })
        await service.processBallRecorded(event)
        expect(cache.setLiveState).not.toHaveBeenCalled()
        expect(cache.invalidateScorecard).not.toHaveBeenCalled()
        expect(cache.invalidateSummary).not.toHaveBeenCalled()
        expect(cache.appendCommentary).not.toHaveBeenCalled()
        expect(webSocketGateway.emitToRoom).not.toHaveBeenCalled()
    })

    // special logic for completed_innings in production
    it("should promote Cache TTL when innings is completed", async() => {
        const completedResult = {
            ...repositoryResult,
            inningsCompleted: true,
            completionReason: "ALL_OUT"
        }
        scorecardRepository.recordBall.mockResolvedValue(completedResult)
        await service.processBallRecorded(event)
        expect(cache.promoteCompletedMatch).toHaveBeenCalledWith(event.payload.matchId)
    })
})
// SRP
// LiveUpdateService orchestrates the live-update workflow.

// DI
// Repository, Cache, WebSocketGateway, Logger and Metrics
// are constructor-injected.

// DIP
// The service does not instantiate PostgreSQL/Redis/Socket.IO itself.

// Separation of Concerns
// Persistence → Repository
// Caching → Cache
// Realtime → WebSocketGateway
// Observability → Logger/Metrics

// Graceful Degradation
// Redis/WebSocket failure does not invalidate successful
// PostgreSQL persistence.

// Idempotency
// Duplicate persistence result stops downstream side effects.

// Testability
// Every external collaborator can be replaced by vi.fn() mocks.
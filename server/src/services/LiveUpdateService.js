export default class LiveUpdateService {
    constructor(scorecardRepository, cache, webSocketGateway, logger, metrics) {
        this.scorecardRepository = scorecardRepository
        this.cache = cache
        this.webSocketGateway = webSocketGateway
        this.logger = logger
        this.metrics = metrics
    }

    async processBallRecorded(event) {
        const result = await this.scorecardRepository.recordBall(event.eventId, event.payload)
        // Duplicate Event
        if(result.duplicate)
        {
            this.metrics.incrementCounter("duplicate_ball_events_total", 1, {
                event_type: event.type ?? "BALL_RECORDED"
            })
            this.logger.warn("Duplicate BALL_RECORDED event ignored", {traceId: event.traceId,
                eventId: event.eventId,
                matchId: event.payload.matchId
            })
            return result
        }
        // Ball Successfully persisted and processed
        this.metrics.incrementCounter("ball_events_processed_total", 1, {
            event_type: event.type ?? "BALL_RECORDED"
        })

         const liveState = {
                matchId: event.payload.matchId,
                inningsId: event.payload.inningsId,
                inningsNumber: event.payload.inningsNumber,
                score: {
                    runs: result.updatedInnings.total_runs,
                    wickets: result.updatedInnings.wickets,
                    legalBalls: result.updatedInnings.legal_balls,
                    extras: result.updatedInnings.extras
                },

                lastDelivery: {
                    deliveryId: result.delivery.id,
                    overNumber: result.delivery.over_number,
                    ballNumber: result.delivery.ball_number,
                    batsmanRuns: result.delivery.batsman_runs,
                    extraRuns: result.delivery.extra_runs,
                    totalRuns: result.delivery.total_runs,
                    wicket: result.delivery.is_wicket,
                    four: result.delivery.is_four,
                    six: result.delivery.is_six

                },
                inningsCompleted: result.inningsCompleted,
                completionReason: result.completionReason,
                updatedAt: new Date().toISOString()
            }
        try {
           
            await this.cache.setLiveState(event.payload.matchId, liveState)

            this.logger.info("Live match state updated in cache", {traceId: event.traceId,
                matchId: event.payload.matchId,
                inningsId: event.payload.inningsId,
                eventId: event.eventId
            })
            // Invalidate stale caches
            await this.cache.invalidateScorecard(event.payload.matchId)
            await this.cache.invalidateSummary(event.payload.matchId)

            this.logger.info("Live match caches refreshed", {traceId: event.traceId,
                matchId: event.payload.matchId,
                eventId: event.eventId
            })

            // Append commentary events to Redis
            const commentaryEvents = [result.commentaryEvent, result.overSummaryEvent,
            ...(result.milestoneEvents ?? []),
            result.inningsEndEvent
            ].filter(Boolean)
            for (const commentaryEvent of commentaryEvents) {
                await this.cache.appendCommentary(event.payload.matchId, commentaryEvent)
            }

            this.logger.info("Commentary events appended to cache", {traceId: event.traceId,
                matchId: event.payload.matchId,
                eventId: event.eventId,
                commentaryCount: commentaryEvents.length
            })

            // Handle innings/match completion TTL transition
            if (result.inningsCompleted) {
                await this.cache.promoteCompletedMatch(event.payload.matchId)
                this.logger.info("Completed innings cache TTL updated", {
                    traceId: event.traceId,
                    matchId: event.payload.matchId,
                    inningsId: event.payload.inningsId,
                    eventId: event.eventId
                })
            }
            this.logger.info(
                "Live match cache operations completed",
                {traceId: event.traceId,
                    matchId: event.payload.matchId,
                    inningsId: event.payload.inningsId,
                    eventId: event.eventId,
                    commentaryCount: commentaryEvents.length
                }
            )
        }
        catch(error)
        {
            this.metrics.incrementCounter("live_update_failures_total", 1, {
                stage: "redis"
            })
            this.logger.error("Redis live cache update failed", {traceId: event.traceId,
                matchId: event.payload.matchId,
                inningsId: event.payload.inningsId,
                eventId: event.eventId,
                error: error.message
            })
        }

        // websocket
        const room = `match:${event.payload.matchId}`
        try{
        this.webSocketGateway.emitToRoom(room, 'BALL_RECORDED', liveState)

        this.logger.info("Live ball update published through WebSocket",
            {traceId: event.traceId,
                matchId: event.payload.matchId,
                inningsId: event.payload.inningsId,
                eventId: event.eventId,
                room
            }
        )
    }
    catch(error)
    {
        this.metrics.incrementCounter("live_update_failures_total", 1, {
            stage: "websocket"
        })
        this.logger.error("WebSocket live update failed", {traceId: event.traceId,
            matchId: event.payload.matchId,
            inningsId: event.payload.inningsId,
            eventId: event.eventId,
            room,
            error: error.message
        })
    }
            return result
        }
}

// SRP
// LiveBallEventHandler → event routing
// LiveUpdateService     → live-update orchestration
// Repository            → persistence
// Cache                 → caching
// WebSocketGateway      → realtime delivery

// DIP
// LiveUpdateService depends on abstractions.

// DI
// Dependencies supplied through constructor.

// OCP
// Redis, PostgreSQL or Socket.IO implementations
// can change without rewriting LiveUpdateService.

// LSP
// Valid implementations can replace current ones.

// Testability
// Mock repository/cache/WebSocket/logger can be injected.
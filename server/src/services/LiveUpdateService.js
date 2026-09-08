export default class LiveUpdateService
{
    constructor(scorecardRepository,cache, webSocketGateway, logger)
    {
        this.scorecardRepository = scorecardRepository
        this.cache = cache
        this.webSocketGateway = webSocketGateway
        this.logger = logger
    }

    async processBallRecorded(event)
    {
        throw new Error("processBallRecorded() must be implemented")
    }
}

// SRP
// LiveBallEventHandler → event routing
// LiveUpdateService    → live-update orchestration
// Repository           → persistence
// Cache                → caching
// WebSocketGateway     → realtime delivery

// DIP
// LiveUpdateService
//      ↓
// Repository / Cache / WebSocket abstractions

// DI
// Dependencies supplied through constructor.

// OCP
// Redis, PostgreSQL or Socket.IO implementations
// can change without rewriting LiveUpdateService.

// LSP
// Any valid implementation of those contracts
// can replace the current implementation.

// Testability
// We can later inject:
// MockScorecardRepository
// MockCache
// MockWebSocketGateway
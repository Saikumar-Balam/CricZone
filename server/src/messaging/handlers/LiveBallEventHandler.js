export default class LiveBallEventHandler {
  constructor(liveUpdateService, logger) {
    this.liveUpdateService = liveUpdateService
    this.logger = logger
    this.handle = this.handle.bind(this)
  }

  async handle(event, metadata = {}) {

    if (!this.isValidEvent(event)) {
      this.logger.warn(
        "Invalid live ball event skipped",
        {
          eventId: event?.eventId,
          eventType: event?.type,
          aggregateId: event?.aggregateId,
          topic: metadata.topic,
          partition: metadata.partition,
          offset: metadata.offset
        }
      )

      return
    }

    switch (event.type) {
      case "BALL_RECORDED":
        await this.handleBallRecorded(
          event,
          metadata
        )
        break

      default:
        this.logger.warn(
          "Unsupported live ball event",
          {
            eventId: event.eventId,
            eventType: event.type,
            aggregateId: event.aggregateId
          }
        )
    }
  }

  isValidEvent(event) {
    if (!event)
      return false

    if (!event.eventId)
      return false

    if (!this.isValidUUID(event.eventId))
      return false

    if (!event.type)
      return false

    if (event.aggregateId == null)
      return false

    if (!event.payload)
      return false

    return true
  }

  isValidUUID(value) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    return uuidRegex.test(value)
  }

  async handleBallRecorded(
    event,
    metadata
  ) {
    const {
      eventId,
      aggregateId,
      timestamp,
      requestId,
      payload
    } = event

    this.logger.info(
      "BALL_RECORDED event received",
      {
        eventId,
        matchId: aggregateId,
        timestamp,
        requestId,
        topic: metadata.topic,
        partition: metadata.partition,
        offset: metadata.offset,
        inningsId: payload.inningsId,
        inningsNumber: payload.inningsNumber,
        overNumber: payload.overNumber,
        ballNumber: payload.ballNumber,
        strikerId: payload.strikerId,
        nonStrikerId: payload.nonStrikerId,
        bowlerId: payload.bowlerId,
        runs: payload.runs,
        extras: payload.extras,
        boundary: payload.boundary,
        wicket: payload.wicket,
        legalDelivery: payload.legalDelivery
      }
    )

    await this.liveUpdateService.processBallRecorded(event)
  }
}

// LLD:
// SRP
// Dependency Injection
// DIP
// Delegation
// Service Layer
// Separation of Concerns
// Testability
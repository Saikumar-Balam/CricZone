import {randomUUID} from "node:crypto"

export const createEvent =  ({
    type, 
    aggregateId,
     payload,
    requestId = null,
    traceId = null
}) => {
    return  {
        eventId: randomUUID(),
        type,
        aggregateId,

        timestamp: new Date().toISOString(),

        requestId,
        traceId: traceId || crypto.randomUUID(),

        payload
    }
}
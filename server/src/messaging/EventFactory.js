import {randomUUID} from "node:crypto"

export const createEvent =  ({
    type, 
    aggregateId,
     payload,
    requestId = null
}) => {
    return  {
        eventId: randomUUID(),
        type,
        aggregateId,

        timestamp: new Date().toISOString(),

        requestId,

        payload
    }
}
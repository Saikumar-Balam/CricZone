export default class EventIdempotencyStore {
    async claim(eventId)
    {
        throw new Error("claim() must be implemented")
    }

    async release(eventId)
    {
        throw new Error("release() must be implemented")
    }
}
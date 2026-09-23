export default class EventRetryStrategy {
    async execute(operation, context = {})
    {
        throw new Error("execute() must be implemented")
    }
}
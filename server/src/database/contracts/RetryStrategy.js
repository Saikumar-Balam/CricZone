export default class RetryStrategy {
    async execute(operation)
    {
        throw new Error("execute() must be implemented")
    }
}
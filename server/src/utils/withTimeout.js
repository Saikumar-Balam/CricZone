export default function withTimeout(operation, timeoutMs, operationName)
{
    let timeoutId
    const timeout = new Promise((__, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
    })
    return Promise.race([operation.finally(() => clearTimeout(timeoutId)), timeout])
}
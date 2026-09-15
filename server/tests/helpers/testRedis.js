import {createClient} from "redis"

export function createTestRedis() {
    if(!process.env.TEST_REDIS_URL)
    {
        throw new Error("TEST_REDIS_URL is required for Redis integration tests")
    }
    const client = createClient({
        url: process.env.TEST_REDIS_URL  
    })
    client.on("error", (error) => {
        console.error("Test Redis error:", {
            name: error.name,
            message: error.message,
            code: error.code
        })
    })
    return client 
}
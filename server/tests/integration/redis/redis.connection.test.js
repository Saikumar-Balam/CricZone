import {describe, it, expect, beforeAll, afterAll} from "vitest"
import { createTestRedis } from "../../helpers/testRedis.js"

describe("Redis Cloud Connection Integration", () => {
    let redisClient 
    beforeAll(async () => {
            redisClient = createTestRedis()
            await redisClient.connect()
    })
    afterAll(async () => {
        if(redisClient?.isReady)
        {
            await redisClient.quit()
        }
    })

    it("should connect to Redis Clous successfully", async () => {
        const response = await redisClient.ping()
        expect(response).toBe("PONG")
    })
})
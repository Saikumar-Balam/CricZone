import {describe, it, expect, beforeAll, afterAll} from "vitest"
import { createTestDatabase } from "../../helpers/testDatabase.js"

describe("PostgresDatabaseClient Integration", () => {
    let database 
    beforeAll(async() => {
        database = createTestDatabase()
        await database.connect()
    })

    afterAll(async() => {
        if(database)
            await database.disconnect()
    })

    it("should connect to PostgresSQL", async () => {
        const result = await database.query("select 1 as value")
        expect(result.rows[0].value).toBe(1)
    })
})
// Vitest
//  ↓
// PostgresDatabaseClient
//  ↓
// pg Pool
//  ↓
// real PostgreSQL
//  ↓
 // SELECT 1


// Your concrete client is well suited for integration testing because connect() acquires a real pooled client, verifies it with SELECT 1, and releases it, while getClient() exposes a transactional client for repository operations. That matches what PostgresScorecardRepository.recordBall() expects when it starts BEGIN/COMMIT/ROLLBACK.
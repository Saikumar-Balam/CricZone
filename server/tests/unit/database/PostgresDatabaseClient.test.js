import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"


const {
    mockPool,
    MockPool
} = vi.hoisted(() => {

    const mockPool = {
        connect: vi.fn(),
        query: vi.fn(),
        end: vi.fn()
    }

    const MockPool = vi.fn(function () {
        return mockPool
    })

    return {
        mockPool,
        MockPool
    }
})


vi.mock("pg", () => ({
    default: {
        Pool: MockPool
    }
}))


import PostgresDatabaseClient
    from "../../../src/database/postgres/PostgresDatabaseClient.js"


const createConfig = () => ({
    connectionString:
        "postgresql://test",

    ssl: {
        rejectUnauthorized: true
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 5000,

    statementTimeoutMillis: 10000
})


describe("PostgreSQL Pool Configuration", () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })


    it("should create pool with database reliability configuration", () => {

        // Arrange
        const config =
            createConfig()


        // Act
        new PostgresDatabaseClient(
            config
        )


        // Assert
        expect(MockPool)
            .toHaveBeenCalledTimes(1)

        expect(MockPool)
            .toHaveBeenCalledWith({
                connectionString:
                    "postgresql://test",

                ssl: {
                    rejectUnauthorized: true
                },

                max: 10,

                idleTimeoutMillis: 30000,

                connectionTimeoutMillis: 5000,

                onConnect:
                    expect.any(Function)
            })
    })


    it("should configure statement timeout before connection becomes available", async () => {

        // Arrange
        const config =
            createConfig()

        new PostgresDatabaseClient(
            config
        )

        const poolConfig =
            MockPool.mock.calls[0][0]

        const mockClient = {
            query: vi.fn()
                .mockResolvedValue({})
        }


        // Act
        await poolConfig.onConnect(
            mockClient
        )


        // Assert
        expect(mockClient.query)
            .toHaveBeenCalledTimes(1)

        expect(mockClient.query)
            .toHaveBeenCalledWith(
                "SET statement_timeout = 10000"
            )
    })
})


// DI — application database configuration is injected.
// Encapsulation — PostgreSQL session configuration stays inside the adapter.
// SRP — database client owns PostgreSQL pool/session configuration.
// Test Isolation — pg.Pool and PostgreSQL client are mocked.
// Adapter Pattern — application timeout config maps to PostgreSQL session configuration.


describe("PostgreSQL Health Check", () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })


    it("should report healthy when PostgreSQL responds successfully", async () => {

        // Arrange
        const config =
            createConfig()

        mockPool.query
            .mockResolvedValue({
                rows: [
                    {
                        "?column?": 1
                    }
                ]
            })

        const databaseClient =
            new PostgresDatabaseClient(
                config
            )


        // Act
        const result =
            await databaseClient.healthCheck()


        // Assert
        expect(mockPool.query)
            .toHaveBeenCalledWith(
                "SELECT 1"
            )

        expect(result)
            .toEqual({
                healthy: true
            })
    })


    it("should report unhealthy when PostgreSQL health query fails", async () => {

        // Arrange
        const config =
            createConfig()

        const databaseError =
            new Error(
                "PostgreSQL unavailable"
            )

        mockPool.query
            .mockRejectedValue(
                databaseError
            )

        const databaseClient =
            new PostgresDatabaseClient(
                config
            )


        // Act
        const result =
            await databaseClient.healthCheck()


        // Assert
        expect(mockPool.query)
            .toHaveBeenCalledWith(
                "SELECT 1"
            )

        expect(result)
            .toEqual({
                healthy: false,
                error: databaseError
            })
    })
})


// SRP — PostgresDatabaseClient owns PostgreSQL health detection.
// DIP — higher layers depend on healthCheck(), not SQL.
// Encapsulation — SELECT 1 remains inside the PostgreSQL adapter.
// Failure Isolation — database failure becomes health state.
// Test Isolation — Neon is not contacted.


describe("PostgreSQL Connection Failure", () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })


    it("should propagate error when PostgreSQL connection fails", async () => {

        // Arrange
        const config =
            createConfig()

        const connectionError =
            new Error(
                "PostgreSQL connection failed"
            )

        mockPool.connect
            .mockRejectedValue(
                connectionError
            )

        const databaseClient =
            new PostgresDatabaseClient(
                config
            )


        // Act + Assert
        await expect(
            databaseClient.connect()
        ).rejects.toBe(
            connectionError
        )

        expect(mockPool.connect)
            .toHaveBeenCalledTimes(1)
    })


    it("should release acquired client when connection verification fails", async () => {

        // Arrange
        const config =
            createConfig()

        const queryError =
            new Error(
                "PostgreSQL verification failed"
            )

        const mockClient = {
            query: vi.fn()
                .mockRejectedValue(
                    queryError
                ),

            release: vi.fn()
        }

        mockPool.connect
            .mockResolvedValue(
                mockClient
            )

        const databaseClient =
            new PostgresDatabaseClient(
                config
            )


        // Act + Assert
        await expect(
            databaseClient.connect()
        ).rejects.toBe(
            queryError
        )

        expect(mockClient.query)
            .toHaveBeenCalledWith(
                "SELECT 1"
            )

        expect(mockClient.release)
            .toHaveBeenCalledTimes(1)
    })
})


// Fail Fast — startup connection failures propagate.
// Resource Management — acquired clients are always released.
// Encapsulation — connection verification belongs to PostgresDatabaseClient.
// SRP — database client manages PostgreSQL connection lifecycle.
// Test Isolation — failures are simulated without breaking Neon.


describe("PostgreSQL Graceful Disconnect", () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })


    it("should gracefully close the PostgreSQL connection pool", async () => {

        // Arrange
        const config =
            createConfig()

        mockPool.end
            .mockResolvedValue()

        const databaseClient =
            new PostgresDatabaseClient(
                config
            )


        // Act
        await databaseClient.disconnect()


        // Assert
        expect(mockPool.end)
            .toHaveBeenCalledTimes(1)
    })
})


// Encapsulation — application code uses disconnect(), not pg.Pool.end().
// SRP — PostgresDatabaseClient owns the PostgreSQL lifecycle.
// DIP — higher layers depend on the database abstraction.
// Resource Management — pooled connections are explicitly terminated.
// Test Isolation — graceful shutdown is tested without closing a real Neon pool.
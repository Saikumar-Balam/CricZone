import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import PostgresScorecardRepository
    from "../../src/repositories/postgres/postgresScorecardRepository.js"


describe("PostgreSQL Failure Path", () => {

    let client
    let databaseClient
    let repository


    beforeEach(() => {

        client = {
            query: vi.fn(),
            release: vi.fn()
        }

        databaseClient = {
            getClient: vi.fn()
                .mockResolvedValue(client)
        }

        repository =
            new PostgresScorecardRepository(
                databaseClient
            )
    })


    it("should propagate PostgreSQL failure", async () => {

        const databaseError =
            new Error(
                "PostgreSQL connection lost"
            )


        client.query
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockRejectedValueOnce(databaseError) // duplicate check
            .mockResolvedValueOnce(undefined) // ROLLBACK


        await expect(
            repository.recordBall(
                "event-failure-001",
                {}
            )
        ).rejects.toThrow(
            "PostgreSQL connection lost"
        )
    })


    it("should rollback transaction when PostgreSQL operation fails", async () => {

        const databaseError =
            new Error(
                "PostgreSQL query failed"
            )


        client.query
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockRejectedValueOnce(databaseError) // duplicate check
            .mockResolvedValueOnce(undefined) // ROLLBACK


        await expect(
            repository.recordBall(
                "event-failure-002",
                {}
            )
        ).rejects.toThrow(
            "PostgreSQL query failed"
        )


        expect(client.query)
            .toHaveBeenCalledWith(
                "ROLLBACK"
            )
    })


    it("should not commit transaction after PostgreSQL failure", async () => {

        const databaseError =
            new Error(
                "PostgreSQL unavailable"
            )


        client.query
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockRejectedValueOnce(databaseError)
            .mockResolvedValueOnce(undefined) // ROLLBACK


        await expect(
            repository.recordBall(
                "event-failure-003",
                {}
            )
        ).rejects.toThrow()


        expect(client.query)
            .not.toHaveBeenCalledWith(
                "COMMIT"
            )
    })


    it("should release PostgreSQL client after failure", async () => {

        const databaseError =
            new Error(
                "Database failure"
            )


        client.query
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockRejectedValueOnce(databaseError)
            .mockResolvedValueOnce(undefined) // ROLLBACK


        await expect(
            repository.recordBall(
                "event-failure-004",
                {}
            )
        ).rejects.toThrow()


        expect(client.release)
            .toHaveBeenCalledOnce()
    })


    it("should rollback before releasing PostgreSQL client", async () => {

        const databaseError =
            new Error(
                "Database operation failed"
            )


        client.query
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockRejectedValueOnce(databaseError)
            .mockResolvedValueOnce(undefined) // ROLLBACK


        await expect(
            repository.recordBall(
                "event-failure-005",
                {}
            )
        ).rejects.toThrow()


        const rollbackCall =
            client.query.mock.invocationCallOrder[
                client.query.mock.calls
                    .findIndex(
                        ([query]) =>
                            query === "ROLLBACK"
                    )
            ]


        const releaseCall =
            client.release
                .mock
                .invocationCallOrder[0]


        expect(rollbackCall)
            .toBeLessThan(releaseCall)
    })

})

// Repository Pattern — PostgreSQL failure behavior stays inside the persistence boundary.
// SRP — repository owns persistence and transaction handling.
// DI — databaseClient is injected, allowing deterministic failure simulation.
// DIP — higher layers remain independent of PostgreSQL implementation details.
// Atomicity — failed transaction is rolled back.
// Resource Safety — client is released through finally.
// Fail-fast propagation — repository doesn't hide the database failure.
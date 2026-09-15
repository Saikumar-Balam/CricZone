import {
    describe,
    it,
    expect,
    vi,
    beforeEach
} from "vitest"

import SocketIOGateway
    from "../../src/websocket/SocketIOGateway.js"


describe("17.13.4 WebSocket Emission Failure", () => {

    let io
    let logger
    let metrics
    let gateway


    beforeEach(() => {

        io = {
            emit: vi.fn(),
            to: vi.fn()
        }

        logger = {
            debug: vi.fn(),
            error: vi.fn()
        }

        metrics = {
            incrementCounter: vi.fn()
        }

        gateway =
            new SocketIOGateway(
                io,
                logger,
                metrics
            )
    })


    describe("broadcast failure", () => {

        it("should propagate WebSocket broadcast failure", () => {

            const socketError =
                new Error(
                    "Socket.IO broadcast failed"
                )

            io.emit.mockImplementation(() => {
                throw socketError
            })


            expect(() =>
                gateway.broadcast(
                    "BALL_RECORDED",
                    {
                        matchId: 101
                    }
                )
            ).toThrow(
                "Socket.IO broadcast failed"
            )
        })


        it("should increment broadcast failure metric", () => {

            io.emit.mockImplementation(() => {
                throw new Error(
                    "Socket unavailable"
                )
            })


            expect(() =>
                gateway.broadcast(
                    "BALL_RECORDED",
                    {}
                )
            ).toThrow()


            expect(
                metrics.incrementCounter
            ).toHaveBeenCalledWith(
                "websocket_emit_failures_total",
                1,
                {
                    scope: "broadcast",
                    event_type:
                        "BALL_RECORDED"
                }
            )
        })


        it("should log broadcast failure", () => {

            io.emit.mockImplementation(() => {
                throw new Error(
                    "Socket unavailable"
                )
            })


            expect(() =>
                gateway.broadcast(
                    "BALL_RECORDED",
                    {}
                )
            ).toThrow()


            expect(logger.error)
                .toHaveBeenCalledWith(
                    "WebSocket broadcast failed",
                    {
                        event:
                            "BALL_RECORDED",

                        errorMessage:
                            "Socket unavailable"
                    }
                )
        })


        it("should not increment success metric after broadcast failure", () => {

            io.emit.mockImplementation(() => {
                throw new Error(
                    "Socket unavailable"
                )
            })


            expect(() =>
                gateway.broadcast(
                    "BALL_RECORDED",
                    {}
                )
            ).toThrow()


            expect(
                metrics.incrementCounter
            ).not.toHaveBeenCalledWith(
                "websocket_emit_total",
                1,
                expect.anything()
            )
        })

    })


    describe("room emission failure", () => {

        it("should propagate room emission failure", () => {

            const socketError =
                new Error(
                    "Room emission failed"
                )

            const roomEmitter = {
                emit: vi.fn(() => {
                    throw socketError
                })
            }

            io.to.mockReturnValue(
                roomEmitter
            )


            expect(() =>
                gateway.emitToRoom(
                    "match:101",
                    "BALL_RECORDED",
                    {
                        matchId: 101
                    }
                )
            ).toThrow(
                "Room emission failed"
            )
        })


        it("should increment room emission failure metric", () => {

            const roomEmitter = {
                emit: vi.fn(() => {
                    throw new Error(
                        "Room unavailable"
                    )
                })
            }

            io.to.mockReturnValue(
                roomEmitter
            )


            expect(() =>
                gateway.emitToRoom(
                    "match:101",
                    "BALL_RECORDED",
                    {}
                )
            ).toThrow()


            expect(
                metrics.incrementCounter
            ).toHaveBeenCalledWith(
                "websocket_emit_failures_total",
                1,
                {
                    scope: "room",
                    event_type:
                        "BALL_RECORDED"
                }
            )
        })


        it("should log room emission failure with room context", () => {

            const roomEmitter = {
                emit: vi.fn(() => {
                    throw new Error(
                        "Room unavailable"
                    )
                })
            }

            io.to.mockReturnValue(
                roomEmitter
            )


            expect(() =>
                gateway.emitToRoom(
                    "match:101",
                    "BALL_RECORDED",
                    {}
                )
            ).toThrow()


            expect(logger.error)
                .toHaveBeenCalledWith(
                    "WebSocket room emission failed",
                    {
                        room:
                            "match:101",

                        event:
                            "BALL_RECORDED",

                        errorMessage:
                            "Room unavailable"
                    }
                )
        })


        it("should not increment success metric after room emission failure", () => {

            const roomEmitter = {
                emit: vi.fn(() => {
                    throw new Error(
                        "Room unavailable"
                    )
                })
            }

            io.to.mockReturnValue(
                roomEmitter
            )


            expect(() =>
                gateway.emitToRoom(
                    "match:101",
                    "BALL_RECORDED",
                    {}
                )
            ).toThrow()


            expect(
                metrics.incrementCounter
            ).not.toHaveBeenCalledWith(
                "websocket_emit_total",
                1,
                expect.anything()
            )
        })

    })

})

// SRP — gateway owns WebSocket transport behavior.
// DI — Socket.IO, logger, and metrics are injected.
// DIP — higher layers can depend on WebSocketGateway.
// LSP — SocketIOGateway substitutes the gateway abstraction.
// Encapsulation — Socket.IO-specific calls remain inside the adapter.
// Observability — failures produce metrics and structured logs.
// Fail-fast propagation — delivery failures aren't silently swallowed.
export default class WebSocketGateway
{
    broadcast(event, payload)
    {
        throw new Error("broadcast() must be implemented")
    }

    emitToRoom(room, event, payload)
    {
        throw new Error("emitToRoom() must be implemented")
    }
}
// SRP — only defines real-time delivery operations.
// DIP — higher-level live-update logic depends on this abstraction, not directly on Socket.IO/ws.
// Abstraction — hides WebSocket library details.
// OCP — new gateway implementations can be added without changing callers.
// LSP — any concrete gateway must honor the same broadcast() and emitToRoom() contract.
// Interface Segregation idea — the contract is small and focused; clients aren't forced to depend on unrelated WebSocket operations.
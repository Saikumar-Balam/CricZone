import { describe, it, expect, vi } from "vitest";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as createClient } from "socket.io-client";

import SocketIOGateway from "../../../src/websocket/SocketIOGateway.js";

import SocketIOAdapterClientFactory from "../../../src/websocket/SocketIOAdapterClientFactory.js";

import SocketIORedisAdapter from "../../../src/websocket/SocketIORedisAdapter.js";

import WebSocketRooms from "../../../src/websocket/WebSocketRooms.js";

describe("WebSocket Multi-Instance Concurrent Broadcast", () => {
  it("should deliver a room event across instances to all subscribed clients", async () => {
    const redisUrl = process.env.TEST_REDIS_URL;

    expect(redisUrl).toBeTruthy();

    const logger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const metrics = {
      incrementCounter: vi.fn(),
    };

    const httpServerA = createServer();
    const httpServerB = createServer();

    const ioA = new Server(httpServerA);
    const ioB = new Server(httpServerB);

    const clients = [];

    let pubClientA;
    let subClientA;
    let pubClientB;
    let subClientB;

    try {
      const factoryA = new SocketIOAdapterClientFactory(
        redisUrl,
        logger,
        metrics,
      );

      const factoryB = new SocketIOAdapterClientFactory(
        redisUrl,
        logger,
        metrics,
      );

      ({ pubClient: pubClientA, subClient: subClientA } =
        await factoryA.create());
      ({ pubClient: pubClientB, subClient: subClientB } =
        await factoryB.create());

      const adapterA = new SocketIORedisAdapter(logger);

      const adapterB = new SocketIORedisAdapter(logger);

      adapterA.attach(ioA, pubClientA, subClientA);

      adapterB.attach(ioB, pubClientB, subClientB);

      await Promise.all([
        new Promise((resolve) => httpServerA.listen(0, resolve)),
        new Promise((resolve) => httpServerB.listen(0, resolve)),
      ]);

      const portB = httpServerB.address().port;

      const clientCount = 25;

      for (let i = 0; i < clientCount; i++) {
        clients.push(
          createClient(`http://localhost:${portB}`, {
            transports: ["websocket"],
            forceNew: true,
            reconnection: false,
          }),
        );
      }

      await Promise.all(clients.map((client) => waitForConnection(client)));

      const matchId = `multi-instance-${Date.now()}-${process.pid}`;

      const room = WebSocketRooms.match(matchId);

      const serverSockets = clients.map((client) =>
        ioB.sockets.sockets.get(client.id),
      );

      expect(serverSockets.every(Boolean)).toBe(true);

      await Promise.all(serverSockets.map((socket) => socket.join(room)));

      expect(ioB.sockets.adapter.rooms.get(room)?.size).toBe(clientCount);

      await waitForAdapterPropagation();

      const receivedEvents = clients.map((client) =>
        waitForEvent(client, "BALL_RECORDED"),
      );

      const gatewayA = new SocketIOGateway(ioA, logger, metrics);

      const payload = {
        matchId: "1001",
        runs: 6,
      };

      gatewayA.emitToRoom(room, "BALL_RECORDED", payload);

      const receivedPayloads = await Promise.all(receivedEvents);

      expect(receivedPayloads).toHaveLength(clientCount);

      for (const receivedPayload of receivedPayloads) {
        expect(receivedPayload).toEqual(payload);
      }

      expect(metrics.incrementCounter).toHaveBeenCalledWith(
        "websocket_emit_total",
        1,
        {
          scope: "room",
          event_type: "BALL_RECORDED",
        },
      );
    } finally {
      for (const client of clients) {
        client.disconnect();
      }

      await Promise.allSettled([closeIO(ioA), closeIO(ioB)]);

      const redisClients = [subClientA, pubClientA, subClientB, pubClientB];

      for (const client of redisClients) {
        if (client?.isOpen) {
          await client.quit();
        }
      }
    }
  }, 20000);
});

function waitForConnection(client) {
  if (client.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    client.once("connect", resolve);

    client.once("connect_error", reject);
  });
}

function waitForEvent(client, event) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 5000);

    client.once(event, (payload) => {
      clearTimeout(timeout);

      resolve(payload);
    });
  });
}

async function waitForAdapterPropagation() {
  await delay(100);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function closeIO(io) {
  return new Promise((resolve) => {
    io.close(() => resolve());
  });
}

// DIP — distributed emission is initiated through SocketIOGateway.
// DI — logger and metrics are injected into infrastructure components.
// Adapter Pattern — Redis/Valkey coordinates independent Socket.IO instances.
// SRP — this test focuses specifically on distributed concurrent fan-out.
// Resource Safety — sockets, servers, publishers, and subscribers are cleaned in finally.
// Scalability Separation — architectural concurrency testing stays separate from heavy load testing.

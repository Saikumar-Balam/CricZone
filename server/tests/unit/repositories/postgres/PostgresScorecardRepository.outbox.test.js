
import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";

import PostgresScorecardRepository from
  "../../../../src/repositories/postgres/postgresScorecardRepository.js";

function createPayload() {
  return {
    matchId: 101,
    inningsId: 201,
    inningsNumber: 1,
    overNumber: 1,
    ballNumber: 2,
    strikerId: 301,
    nonStrikerId: 302,
    bowlerId: 401,

    runs: {
      batsman: 4,
      extras: 0,
      total: 4
    },

    extras: {
      wide: 0,
      noBall: 0,
      bye: 0,
      legBye: 0,
      penalty: 0
    },

    boundary: {
      four: true,
      six: false
    },

    wicket: {
      occurred: false,
      type: null,
      dismissedPlayerId: null,
      fielderId: null
    },

    legalDelivery: true,

    currentState: {
      strikerId: 301,
      nonStrikerId: 302,
      bowlerId: 401
    },

    commentary: {
      title: "FOUR",
      text: "Four runs scored"
    }
  };
}

function createDatabaseMock({
  duplicate = false,
  failOutbox = false
} = {}) {
  const statements = [];

  const client = {
    release: vi.fn(),

    query: vi.fn(async (sql, params = []) => {
      const text = sql.trim().replace(/\s+/g, " ").toLowerCase();

      statements.push({ text, params });

      if (
        text.startsWith("select id from deliveries")
      ) {
        return {
          rows: duplicate ? [{ id: 1 }] : []
        };
      }

      if (text.includes("select s.format")) {
        return { rows: [{ format: "T20" }] };
      }

      if (
        text.startsWith("select * from innings")
      ) {
        return {
          rows: [{
            innings_type: "REGULAR",
            legal_balls: 1,
            wickets: 0,
            total_runs: 100,
            target_runs: null
          }]
        };
      }

      if (
        text.startsWith("select * from bowling_performances")
      ) {
        return {
          rows: [{
            balls_bowled: 1,
            runs_conceded: 0,
            wickets: 0
          }]
        };
      }

      if (
        text.startsWith("insert into deliveries")
      ) {
        return {
          rows: [{ id: 501 }]
        };
      }

      if (
        text.startsWith("update innings") &&
        text.includes("total_runs =")
      ) {
        return {
          rows: [{
            total_runs: 104,
            wickets: 0,
            legal_balls: 2,
            extras: 0
          }]
        };
      }

      if (
        text.startsWith("update innings") &&
        text.includes("current_striker_id")
      ) {
        return {
          rows: [{
            current_striker_id: 301,
            current_non_striker_id: 302
          }]
        };
      }

      if (
        text.startsWith("update bowling_performances")
      ) {
        return {
          rows: [{
            balls_bowled: 2,
            runs_conceded: 4,
            wickets: 0,
            overs: "0.2",
            economy: 12
          }]
        };
      }

      if (
        text.startsWith("update scorecards")
      ) {
        return {
          rows: [{ id: 601 }]
        };
      }

      if (
        text.startsWith("insert into commentary_events")
      ) {
        return {
          rows: [{ id: 701 }]
        };
      }

      if (
        text.startsWith("insert into public.cache_invalidation_outbox")
      ) {
        if (failOutbox) {
          throw new Error("Simulated outbox insertion failure");
        }

        return { rowCount: 1, rows: [] };
      }

      return { rows: [], rowCount: 0 };
    })
  };

  const database = {
    getClient: vi.fn(async () => client)
  };

  return {
    database,
    client,
    statements
  };
}

describe("Transactional cache invalidation outbox", () => {
  it("inserts invalidation before COMMIT", async () => {
    const { database, client, statements } =
      createDatabaseMock();

    const repository =
      new PostgresScorecardRepository(database);

    const eventId = randomUUID();

    const result = await repository.recordBall(
      eventId,
      createPayload()
    );

    expect(result.duplicate).not.toBe(true);

    const outboxIndex = statements.findIndex(
      item => item.text.startsWith(
        "insert into public.cache_invalidation_outbox"
      )
    );

    const commitIndex = statements.findIndex(
      item => item.text === "commit"
    );

    expect(outboxIndex).toBeGreaterThan(-1);
    expect(commitIndex).toBeGreaterThan(outboxIndex);

    const outbox = statements[outboxIndex];

    expect(outbox.params[0]).toBe(eventId);
    expect(outbox.params[1]).toBe(101);

    expect(JSON.parse(outbox.params[2])).toEqual(
      expect.arrayContaining([
        "match:101",
        "scorecard:101",
        "match:101:summary",
        "test:criczone:match:101:live"
      ])
    );

    expect(client.release).toHaveBeenCalledOnce();
  });

  it("does not insert an outbox event for duplicates", async () => {
    const { database, statements, client } =
      createDatabaseMock({ duplicate: true });

    const repository =
      new PostgresScorecardRepository(database);

    const result = await repository.recordBall(
      randomUUID(),
      createPayload()
    );

    expect(result.duplicate).toBe(true);

    expect(statements.some(
      item => item.text.startsWith(
        "insert into public.cache_invalidation_outbox"
      )
    )).toBe(false);

    expect(statements.some(
      item => item.text === "rollback"
    )).toBe(true);

    expect(statements.some(
      item => item.text === "commit"
    )).toBe(false);

    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back when outbox insertion fails", async () => {
    const { database, statements, client } =
      createDatabaseMock({ failOutbox: true });

    const repository =
      new PostgresScorecardRepository(database);

    await expect(
      repository.recordBall(
        randomUUID(),
        createPayload()
      )
    ).rejects.toThrow(
      "Simulated outbox insertion failure"
    );

    expect(statements.some(
      item => item.text === "rollback"
    )).toBe(true);

    expect(statements.some(
      item => item.text === "commit"
    )).toBe(false);

    expect(client.release).toHaveBeenCalledOnce();
  });
});

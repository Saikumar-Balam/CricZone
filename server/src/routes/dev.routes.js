import express from "express";

import { eventProducer } from "../containers/messaging.container.js";
import { KafkaTopics } from "../messaging/KafkaTopics.js";
import { createEvent } from "../messaging/EventFactory.js";

const router = express.Router();

router.post("/kafka-test", async (req, res, next) => {
  try {
    const event = createEvent({
      type: "BALL_RECORDED",
      aggregateId: 2,
      requestId: req.requestId,
      traceId: req.traceId,

      payload: {
        matchId: 2,
        inningsId: 6,
        inningsNumber: 1,

        battingTeamId: 1,
        bowlingTeamId: 2,

        overNumber: 0,
        ballNumber: 5,

        strikerId: 2,
        nonStrikerId: 1,
        bowlerId: 5,

        runs: {
          batsman: 0,
          extras: 1,
          total: 1
        },

        extras: {
          wide: 0,
          noBall: 0,
          bye: 1,
          legBye: 0,
          penalty: 0
        },

        boundary: {
          four: false,
          six: false
        },

        wicket: {
          occurred: false,
          type: null,
          dismissedPlayerId: null,
          fielderId: null,
          dismissalText: null
        },

        legalDelivery: true,

        commentary: {
          title: null,
          text: "Mitchell Starc to Jasprit Bumrah, 1 bye"
        },

        currentState: {
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 5
        }
      }
    });

    await eventProducer.publish(
      KafkaTopics.LIVE_BALL_EVENTS,
      event
    );

    return res.status(200).json({
      success: true,
      message: "Kafka event published successfully",
      event
    });

  } catch (error) {
    next(error);
  }
});

export default router;
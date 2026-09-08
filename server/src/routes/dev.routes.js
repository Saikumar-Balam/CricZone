import express from "express"
import { eventProducer } from "../containers/messaging.container.js"
import { KafkaTopics } from "../messaging/KafkaTopics.js"
import { createEvent } from "../messaging/EventFactory.js"

const router = express.Router()

router.post("/kafka-test", async(req, res, next) =>{
    try{
        const event = createEvent({
            type: "BALL_RECORDED",
            aggregateId: 2,
            requestId: req.requestId,

            payload:{
                     matchId: 2,

                    inningsId: 10,
                    inningsNumber: 1,

                    battingTeamId: 1,
                    bowlingTeamId: 2,

                    overNumber: 6,
                    ballNumber: 6,

                    strikerId: 17,
                    nonStrikerId: 18,
                    bowlerId: 31,

                    runs: {
                        batsman: 1,
                        extras: 0,
                        total: 1
                    },

                    extras: {
                        wide: 0,
                        noBall: 0,
                        bye: 0,
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
                        text:
                            "Bumrah to Virat",
                        title: null
                    }
            }
        })

        await eventProducer.publish(KafkaTopics.LIVE_BALL_EVENTS, event)

        return res.status(200).json({
            success: true,
            message: "Kafka event published successfully",
            event
        })
    }
    catch(error)
    {
        next(error)
    }
})

export default router
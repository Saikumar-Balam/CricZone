export function createBallPayload(fixture)
{
    return {
        matchId: 2,
        inningsId: 6,
        overNumber: 5,
        ballNumber: 3,
        strikerId: 1,
        nonStrikerId: 2,
        bowlerId: 5,
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
            fielderId: null,
            dismissalText: null
        },
        legalDelivery: true,
        currentState: {
            strikerId: 1,
            nonStrikerId: 2,
            bowlerId: 5
        },
        commentary: {
            title: "FOUR",
            text: "Driven through covers for four"
        }
    }
}
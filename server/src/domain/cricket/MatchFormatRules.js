export const MatchFormatRules = {
  T10: {
    inningsMaxBalls: 60,
    wicketsToEndInnings: 10,
    ballsPerOver: 6,
    bowlerMaxBalls: 12,

    milestones: {
      batterRuns: [30, 50, 75, 100, 150],
      teamRuns: [50, 100, 150, 200, 250]
    }
  },

  T20: {
    inningsMaxBalls: 120,
    wicketsToEndInnings: 10,
    ballsPerOver: 6,
    bowlerMaxBalls: 24,

    milestones: {
      batterRuns: [50, 100, 150, 200],
      teamRuns: [50, 100, 150, 200, 250, 300]
    }
  },

  ODI: {
    inningsMaxBalls: 300,
    wicketsToEndInnings: 10,
    ballsPerOver: 6,
    bowlerMaxBalls: 60,

    milestones: {
      batterRuns: [50, 100, 150, 200, 250, 300],
      teamRuns: [
        50,
        100,
        150,
        200,
        250,
        300,
        350,
        400,
        450,
        500
      ]
    }
  },

  TEST: {
    inningsMaxBalls: null,
    wicketsToEndInnings: 10,
    ballsPerOver: 6,
    bowlerMaxBalls: null,

    milestones: {
      batterRuns: [
        50,
        100,
        150,
        200,
        250,
        300, 
        350,
        400,
        450,
        500
      ],

      teamRuns: [
        100,
        200,
        300,
        400,
        500,
        600,
        700,
        800,
        900,
        1000
      ]
    }
  },

  HUNDRED: {
    inningsMaxBalls: 100,
    wicketsToEndInnings: 10,
    ballsPerOver: 5,
    bowlerMaxBalls: 20,

    milestones: {
      batterRuns: [50, 100, 150, 200],
      teamRuns: [50, 100, 150, 200]
    }
  }
}
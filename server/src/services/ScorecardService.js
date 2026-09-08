import ScorecardNotFoundError from "../errors/ScorecardNotFoundError.js";

export default class ScorecardService {
  constructor(scorecardRepository) {
    this.scorecardRepository = scorecardRepository;
  }

  async getScorecardByMatchId(matchId) {
    const scorecard =
      await this.scorecardRepository.findByMatchId(matchId);
    if (!scorecard) {
      throw new ScorecardNotFoundError(matchId);
    }
    const innings = await this.scorecardRepository.findInningsByScorecardId(
      scorecard.id,
    );

    const inningsWithPerformances = await Promise.all(
      innings.map(async (inning) => {
        const [batting_performances, bowling_performances] = await Promise.all([
          this.scorecardRepository.findBattingPerformancesByInningsId(
            inning.id),
            this.scorecardRepository.findBowlingPerformancesByInningsId(inning.id),
        ]);
        return {
            ...inning,
            batting_performances,
            bowling_performances
        }
      }),
    );

     return {
            id: scorecard.id,
            matchId: scorecard.match_id,
            innings: inningsWithPerformances
        }
  }
}
// getScorecardByMatchId(matchId)
//         ↓
// find scorecard
//         ↓
// scorecard exists?
//    ├── NO → ScorecardNotFoundError
//    │
//    └── YES
//         ↓
// find innings
//         ↓
// for each innings
//    ├── find batting performances
//    └── find bowling performances
//         ↓
// assemble nested response

// The outer Promise.all() also allows innings data to be assembled concurrently.
// LLD principles here are Service Layer Pattern, SRP, constructor DI, DIP, and separation of persistence from orchestration.
function MatchDetails() {
  const match = {
    series: "India Tour 2026",
    matchNumber: "1st Test",
    venue: "Galle International Stadium, Galle",

    team1: {
      name: "India",
      score: "246/4",
      overs: "42.3",
    },

    team2: {
      name: "Sri Lanka",
      score: "—",
      overs: "",
    },

    status: "LIVE",
    result: "India batting",

    batsmen: [
      {
        name: "Shubman Gill",
        runs: 84,
        balls: 112,
        fours: 8,
        sixes: 1,
      },
      {
        name: "Rishabh Pant",
        runs: 42,
        balls: 56,
        fours: 5,
        sixes: 0,
      },
    ],

    bowlers: [
      {
        name: "Prabath Jayasuriya",
        overs: "12.3",
        runs: 54,
        wickets: 2,
      },
      {
        name: "Asitha Fernando",
        overs: "10.0",
        runs: 48,
        wickets: 1,
      },
    ],

    commentary: [
      "42.3 — Jayasuriya to Pant, defended towards cover.",
      "42.2 — Jayasuriya to Pant, FOUR! Beautiful shot through extra cover.",
      "42.1 — Jayasuriya to Gill, single taken.",
      "41.6 — Fernando to Gill, no run.",
    ],
  };

  return (
    <div className="space-y-6">

      {/* Match Header */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ">

        <div className="flex flex-col gap-2 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-sm font-semibold text-green-600">
              {match.series}
            </p>

            <h1 className="mt-1 text-2xl font-bold">
              {match.matchNumber}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {match.venue}
            </p>
          </div>

          <span className="w-fit rounded-full bg-red-100 px-4 py-2 text-sm font-bold text-red-600">
            {match.status}
          </span>

        </div>

        {/* Score */}
        <div className="mt-6 grid gap-6 sm:grid-cols-2">

          <div className="rounded-xl bg-gray-50 p-5">
            <p className="font-semibold">
              {match.team1.name}
            </p>

            <p className="mt-2 text-3xl font-bold">
              {match.team1.score}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {match.team1.overs} overs
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-5">
            <p className="font-semibold">
              {match.team2.name}
            </p>

            <p className="mt-2 text-3xl font-bold">
              {match.team2.score || "Yet to bat"}
            </p>

            {match.team2.overs && (
              <p className="mt-1 text-sm text-gray-500">
                {match.team2.overs} overs
              </p>
            )}
          </div>

        </div>

        <p className="mt-5 text-center text-sm font-semibold text-green-600">
          {match.result}
        </p>

      </section>

      {/* Navigation */}
      <div className="flex gap-2 overflow-x-auto rounded-xl bg-white p-2 shadow-sm">

        <button className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white">
          Scorecard
        </button>

        <button className="rounded-lg px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Commentary
        </button>

        <button className="rounded-lg px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Playing XI
        </button>

        <button className="rounded-lg px-5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100">
          Match Info
        </button>

      </div>

      {/* Batting */}
      <section className="rounded-xl bg-white p-5 shadow-sm">

        <h2 className="mb-4 text-xl font-bold">
          India Batting
        </h2>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[600px] text-left text-sm">

            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="pb-3">Batter</th>
                <th className="pb-3">R</th>
                <th className="pb-3">B</th>
                <th className="pb-3">4s</th>
                <th className="pb-3">6s</th>
              </tr>
            </thead>

            <tbody>

              {match.batsmen.map((batsman) => (
                <tr
                  key={batsman.name}
                  className="border-b border-gray-100"
                >
                  <td className="py-4 font-medium">
                    {batsman.name}
                  </td>

                  <td className="py-4 font-bold">
                    {batsman.runs}
                  </td>

                  <td className="py-4">
                    {batsman.balls}
                  </td>

                  <td className="py-4">
                    {batsman.fours}
                  </td>

                  <td className="py-4">
                    {batsman.sixes}
                  </td>
                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>

      {/* Bowling */}
      <section className="rounded-xl bg-white p-5 shadow-sm">

        <h2 className="mb-4 text-xl font-bold">
          Sri Lanka Bowling
        </h2>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[600px] text-left text-sm">

            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="pb-3">Bowler</th>
                <th className="pb-3">O</th>
                <th className="pb-3">R</th>
                <th className="pb-3">W</th>
              </tr>
            </thead>

            <tbody>

              {match.bowlers.map((bowler) => (
                <tr
                  key={bowler.name}
                  className="border-b border-gray-100"
                >
                  <td className="py-4 font-medium">
                    {bowler.name}
                  </td>

                  <td className="py-4">
                    {bowler.overs}
                  </td>

                  <td className="py-4">
                    {bowler.runs}
                  </td>

                  <td className="py-4 font-bold">
                    {bowler.wickets}
                  </td>
                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>

      {/* Commentary */}
      <section className="rounded-xl bg-white p-5 shadow-sm">

        <h2 className="mb-4 text-xl font-bold">
          Commentary
        </h2>

        <div className="space-y-3">

          {match.commentary.map((ball, index) => (
            <div
              key={index}
              className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700"
            >
              {ball}
            </div>
          ))}

        </div>

      </section>

    </div>
  );
}

export default MatchDetails;
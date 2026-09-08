const rankings = {
  batting: [
    {
      rank: 1,
      player: "Joe Root",
      team: "England",
      rating: 895,
    },
    {
      rank: 2,
      player: "Shubman Gill",
      team: "India",
      rating: 887,
    },
    {
      rank: 3,
      player: "Kane Williamson",
      team: "New Zealand",
      rating: 876,
    },
    {
      rank: 4,
      player: "Babar Azam",
      team: "Pakistan",
      rating: 865,
    },
    {
      rank: 5,
      player: "Virat Kohli",
      team: "India",
      rating: 854,
    },
  ],

  bowling: [
    {
      rank: 1,
      player: "Jasprit Bumrah",
      team: "India",
      rating: 898,
    },
    {
      rank: 2,
      player: "Pat Cummins",
      team: "Australia",
      rating: 884,
    },
    {
      rank: 3,
      player: "Kagiso Rabada",
      team: "South Africa",
      rating: 871,
    },
    {
      rank: 4,
      player: "Shaheen Afridi",
      team: "Pakistan",
      rating: 862,
    },
    {
      rank: 5,
      player: "Nathan Lyon",
      team: "Australia",
      rating: 850,
    },
  ],

  allRounders: [
    {
      rank: 1,
      player: "Ravindra Jadeja",
      team: "India",
      rating: 423,
    },
    {
      rank: 2,
      player: "Ben Stokes",
      team: "England",
      rating: 412,
    },
    {
      rank: 3,
      player: "Marco Jansen",
      team: "South Africa",
      rating: 398,
    },
    {
      rank: 4,
      player: "Shakib Al Hasan",
      team: "Bangladesh",
      rating: 390,
    },
    {
      rank: 5,
      player: "Mitchell Marsh",
      team: "Australia",
      rating: 382,
    },
  ],
};

function Rankings() {
  const currentRankings = rankings.batting;

  return (
    <div className="space-y-8 ">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Cricket Rankings
        </h1>

        <p className="mt-2 text-gray-500">
          Latest player rankings across different categories.
        </p>
      </div>

      {/* Category Buttons */}
      <div className="flex  gap-3 overflow-x-auto">

        <button className=" rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white">
          Batting
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Bowling
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          All-Rounders
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Teams
        </button>

      </div>

      {/* Rankings Table */}
      <section className="overflow-hidden  dark:bg-gray-900 rounded-xl border border-gray-200 bg-white shadow-sm">

        <div className="border-b border-gray-00 p-5">
          <h2 className="text-xl font-bold">
            Test Batting Rankings
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Player ratings
          </p>
        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[600px] text-left">

            <thead className="bg-gray-300 text-sm text-gray-500">
              <tr>
                <th className="px-5 py-4">
                  Rank
                </th>

                <th className="px-5 py-4">
                  Player
                </th>

                <th className="px-5 py-4">
                  Team
                </th>

                <th className="px-5 py-4">
                  Rating
                </th>
              </tr>
            </thead>

            <tbody>

              {currentRankings.map((player) => (
                <tr
                  key={player.rank}
                  className="border-t border-gray-100 hover:bg-gray-600"
                >

                  <td className="px-5 py-4 font-bold">
                    #{player.rank}
                  </td>

                  <td className="px-5 py-4 font-semibold">
                    {player.player}
                  </td>

                  <td className="px-5 py-4 text-gray-500">
                    {player.team}
                  </td>

                  <td className="px-5 py-4 font-bold text-green-600">
                    {player.rating}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}

export default Rankings;
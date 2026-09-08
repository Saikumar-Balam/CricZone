const stats = {
  runs: [
    { rank: 1, player: "Virat Kohli", team: "India", value: 1248 },
    { rank: 2, player: "Joe Root", team: "England", value: 1187 },
    { rank: 3, player: "Shubman Gill", team: "India", value: 1124 },
    { rank: 4, player: "Babar Azam", team: "Pakistan", value: 1089 },
    { rank: 5, player: "Kane Williamson", team: "New Zealand", value: 1045 },
  ],

  wickets: [
    { rank: 1, player: "Jasprit Bumrah", team: "India", value: 48 },
    { rank: 2, player: "Pat Cummins", team: "Australia", value: 44 },
    { rank: 3, player: "Kagiso Rabada", team: "South Africa", value: 41 },
    { rank: 4, player: "Shaheen Afridi", team: "Pakistan", value: 39 },
    { rank: 5, player: "Nathan Lyon", team: "Australia", value: 37 },
  ],

  sixes: [
    { rank: 1, player: "Rohit Sharma", team: "India", value: 62 },
    { rank: 2, player: "Jos Buttler", team: "England", value: 58 },
    { rank: 3, player: "Glenn Maxwell", team: "Australia", value: 54 },
    { rank: 4, player: "Nicholas Pooran", team: "West Indies", value: 51 },
    { rank: 5, player: "Suryakumar Yadav", team: "India", value: 49 },
  ],
};

function Stats() {
  return (
    <div className="space-y-8  dark:bg-gray-900">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Cricket Statistics
        </h1>

        <p className="mt-2 text-gray-500">
          Explore the latest cricket statistics and player performances.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 overflow-x-auto">

        <button className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white">
          Test
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          ODI
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          T20
        </button>

      </div>

      {/* Stat Cards */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Runs */}
        <StatCard
          title="Top Run Scorers"
          subtitle="Most runs"
          data={stats.runs}
          suffix="runs"
        />

        {/* Wickets */}
        <StatCard
          title="Top Wicket Takers"
          subtitle="Most wickets"
          data={stats.wickets}
          suffix="wickets"
        />

        {/* Sixes */}
        <StatCard
          title="Most Sixes"
          subtitle="Maximum sixes"
          data={stats.sixes}
          suffix="sixes"
        />

      </div>

    </div>
  );
}

function StatCard({ title, subtitle, data, suffix }) {
  return (
    <section className="rounded-xl text-green-700  dark:bg-gray-900 border border-gray-200 bg-white p-5 shadow-sm">

      <div className="border-b border-gray-100 pb-4 ">
        <h2 className="text-lg  font-bold">
          {title}
        </h2>

        <p className="mt-1  text-sm text-gray-500">
          {subtitle}
        </p>
      </div>

      <div className="mt-4 space-y-3">

        {data.map((item) => (
          <div
            key={item.rank}
            className="flex  items-center  justify-between rounded-lg bg-gray-600 p-3"
          >

            <div className="flex items-center gap-3">

              <span className="w-6  text-sm  font-bold text-gray-400">
                {item.rank}
              </span>

              <div>
                <p className="text-sm text-gray-500 font-semibold">
                  {item.player}
                </p>

                <p className="text-xs text-gray-500">
                  {item.team}
                </p>
              </div>

            </div>

            <div className="text-right">
              <p className="font-bold text-green-600">
                {item.value}
              </p>

              <p className="text-xs text-gray-400">
                {suffix}
              </p>
            </div>

          </div>
        ))}

      </div>

    </section>
  );
}

export default Stats;
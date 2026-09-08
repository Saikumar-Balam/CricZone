function PlayerDetails() {
  const player = {
    name: "Virat Kohli",
    initials: "VK",
    role: "Right Hand Batter",
    team: "India",
    country: "IND",
    matches: 287,
    runs: 13848,
    average: 58.67,
    centuries: 51,
  };

  return (
    <div className="space-y-6">

      {/* Player Header */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-3xl font-bold text-green-700">
            {player.initials}
          </div>

          <div>
            <p className="text-sm font-semibold text-green-600">
              {player.team}
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              {player.name}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {player.role}
            </p>
          </div>

        </div>

      </section>

      {/* Career Stats */}
      <section>

        <h2 className="mb-4 text-xl font-bold">
          Career Statistics
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Matches</p>
            <p className="mt-2 text-2xl font-bold">
              {player.matches}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Runs</p>
            <p className="mt-2 text-2xl font-bold">
              {player.runs.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Average</p>
            <p className="mt-2 text-2xl font-bold">
              {player.average}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Centuries</p>
            <p className="mt-2 text-2xl font-bold">
              {player.centuries}
            </p>
          </div>

        </div>

      </section>

      {/* Recent Matches */}
      <section className="rounded-xl bg-white p-6 shadow-sm">

        <h2 className="text-xl font-bold">
          Recent Matches
        </h2>

        <div className="mt-5 space-y-3">

          {[
            "India vs Sri Lanka — 84 runs",
            "India vs Australia — 72 runs",
            "India vs England — 103 runs",
            "India vs South Africa — 45 runs",
          ].map((match) => (
            <div
              key={match}
              className="rounded-lg bg-gray-50 p-4 text-sm font-medium"
            >
              {match}
            </div>
          ))}

        </div>

      </section>

    </div>
  );
}

export default PlayerDetails;
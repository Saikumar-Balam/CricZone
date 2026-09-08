function TeamDetails() {
  const team = {
    name: "India",
    shortName: "IND",
    country: "International",
    ranking: 1,
    matches: 12,
    wins: 8,
    losses: 3,
    draws: 1,
  };

  return (
    <div className="space-y-6">

      {/* Team Header */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-700">
            {team.shortName}
          </div>

          <div>
            <p className="text-sm font-semibold text-green-600">
              {team.country}
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              {team.name}
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              World Ranking #{team.ranking}
            </p>
          </div>

        </div>

      </section>

      {/* Statistics */}
      <section className="grid gap-4 sm:grid-cols-4">

        <div className="rounded-xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-gray-500">Matches</p>
          <p className="mt-2 text-2xl font-bold">{team.matches}</p>
        </div>

        <div className="rounded-xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-gray-500">Wins</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {team.wins}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-gray-500">Losses</p>
          <p className="mt-2 text-2xl font-bold">
            {team.losses}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm text-gray-500">Draws</p>
          <p className="mt-2 text-2xl font-bold">
            {team.draws}
          </p>
        </div>

      </section>

      {/* Squad */}
      <section className="rounded-xl bg-white p-6 shadow-sm">

        <h2 className="text-xl font-bold">
          Squad
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

          {[
            "Shubman Gill",
            "Jasprit Bumrah",
            "Virat Kohli",
            "Ravindra Jadeja",
            "Rishabh Pant",
            "Yashasvi Jaiswal",
          ].map((player) => (
            <div
              key={player}
              className="rounded-lg bg-gray-50 p-4 font-medium"
            >
              {player}
            </div>
          ))}

        </div>

      </section>

    </div>
  );
}

export default TeamDetails;
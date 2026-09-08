import PlayerCard from "../components/PlayerCard";

const players = [
  {
    name: "Virat Kohli",
    initials: "VK",
    role: "Batter",
    team: "India",
    country: "IND",
  },
  {
    name: "Jasprit Bumrah",
    initials: "JB",
    role: "Bowler",
    team: "India",
    country: "IND",
  },
  {
    name: "Shubman Gill",
    initials: "SG",
    role: "Batter",
    team: "India",
    country: "IND",
  },
  {
    name: "Ravindra Jadeja",
    initials: "RJ",
    role: "All-Rounder",
    team: "India",
    country: "IND",
  },
  {
    name: "Joe Root",
    initials: "JR",
    role: "Batter",
    team: "England",
    country: "ENG",
  },
  {
    name: "Pat Cummins",
    initials: "PC",
    role: "Bowler",
    team: "Australia",
    country: "AUS",
  },
  {
    name: "Babar Azam",
    initials: "BA",
    role: "Batter",
    team: "Pakistan",
    country: "PAK",
  },
  {
    name: "Kane Williamson",
    initials: "KW",
    role: "Batter",
    team: "New Zealand",
    country: "NZ",
  },
];

function Players() {
  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Cricket Players
        </h1>

        <p className="mt-2 text-gray-500">
          Explore players, roles and teams.
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search players..."
        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
      />

      {/* Filters */}
      <div className="flex gap-3 overflow-x-auto">

        <button className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white">
          All
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Batters
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Bowlers
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          All-Rounders
        </button>

      </div>

      {/* Players */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

        {players.map((player) => (
          <PlayerCard
            key={player.name}
            player={player}
          />
        ))}

      </div>

    </div>
  );
}

export default Players;
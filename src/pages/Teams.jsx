import TeamCard from "../components/TeamCard";

const teams = [
  {
    name: "India",
    shortName: "IND",
    country: "International",
    matches: 12,
  },
  {
    name: "Australia",
    shortName: "AUS",
    country: "International",
    matches: 10,
  },
  {
    name: "England",
    shortName: "ENG",
    country: "International",
    matches: 11,
  },
  {
    name: "Pakistan",
    shortName: "PAK",
    country: "International",
    matches: 9,
  },
  {
    name: "Sri Lanka",
    shortName: "SL",
    country: "International",
    matches: 8,
  },
  {
    name: "South Africa",
    shortName: "SA",
    country: "International",
    matches: 10,
  },
  {
    name: "New Zealand",
    shortName: "NZ",
    country: "International",
    matches: 9,
  },
  {
    name: "West Indies",
    shortName: "WI",
    country: "International",
    matches: 8,
  },
  {
    name: "Bangladesh",
    shortName: "BAN",
    country: "International",
    matches: 7,
  },
];

function Teams() {
  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Cricket Teams
        </h1>

        <p className="mt-2 text-gray-500">
          Explore international and domestic cricket teams.
        </p>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search teams..."
        className="w-full rounded-lg border text-black border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
      />

      {/* Teams */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

        {teams.map((team) => (
          <TeamCard
            key={team.name}
            team={team}
          />
        ))}

      </div>

    </div>
  );
}

export default Teams;
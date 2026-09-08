import MatchCard from "../components/MatchCard";

const matches = [
  {
    status: "LIVE",
    series: "India Tour 2026",
    teams: [
      { name: "India", score: "246/4", overs: "42.3" },
      { name: "Sri Lanka", score: "", overs: "" },
    ],
    venue: "Galle International Stadium",
    result: "India batting",
  },
  {
    status: "UPCOMING",
    series: "DPL 2026",
    teams: [
      { name: "Delhi Lions", score: "", overs: "" },
      { name: "Delhi Superstarz", score: "", overs: "" },
    ],
    venue: "Arun Jaitley Stadium",
    result: "Starts in 02h : 15m",
  },
  {
    status: "COMPLETED",
    series: "CPL 2026",
    teams: [
      { name: "Jamaica Kingsmen", score: "177/5", overs: "20.0" },
      { name: "St Kitts Patriots", score: "168/7", overs: "20.0" },
    ],
    venue: "Sabina Park, Kingston",
    result: "Jamaica won by 9 runs",
  },
];

function Matches() {
  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Cricket Matches
        </h1>

        <p className="mt-2 text-gray-500">
          Follow live, upcoming and completed cricket matches.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 overflow-x-auto">
        <button className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white">
          All
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Live
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Upcoming
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Completed
        </button>
      </div>

      {/* Matches */}
      <div className="grid gap-5 md:grid-cols-2">

        {matches.map((match, index) => (
          <MatchCard
            key={index}
            match={match}
          />
        ))}

      </div>

    </div>
  );
}

export default Matches;
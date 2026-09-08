import { useState } from "react";

const searchData = [
  {
    id: 1,
    name: "Virat Kohli",
    type: "Player",
    description: "India • Batter",
  },
  {
    id: 2,
    name: "India",
    type: "Team",
    description: "International Cricket Team",
  },
  {
    id: 3,
    name: "India Tour of Sri Lanka 2026",
    type: "Series",
    description: "International • 3 Matches",
  },
  {
    id: 4,
    name: "India vs Sri Lanka",
    type: "Match",
    description: "1st Test • Galle",
  },
  {
    id: 5,
    name: "India announce squad for upcoming Test series",
    type: "News",
    description: "India • 25 minutes ago",
  },
];

function Search() {
  const [query, setQuery] = useState("");

  const results = searchData.filter((item) =>
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 ">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold ">
          Search CricZone
        </h1>

        <p className="mt-2 text-gray-500">
          Search for players, teams, matches, series and news.
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cricket..."
          className="w-full rounded-xl border border-gray-200 bg-white text-slate-700 px-5 py-4 pr-12 text-sm outline-none shadow-sm focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />

        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">
          🔍
        </span>

      </div>

      {/* Results */}
      {query && (
        <section className="space-y-3">

          <h2 className="text-lg font-bold">
            Search Results
          </h2>

          {results.length > 0 ? (
            results.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <h3 className="font-bold">
                      {item.name}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      {item.description}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
                    {item.type}
                  </span>

                </div>

              </div>
            ))
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              No results found.
            </div>
          )}

        </section>
      )}

      {/* Empty state */}
      {!query && (
        <div className="rounded-xl  dark:bg-gray-900 border border-dashed border-gray-300 bg-white p-10 text-center">

          <p className="text-gray-500">
            Start typing to search CricZone.
          </p>

        </div>
      )}

    </div>
  );
}

export default Search;
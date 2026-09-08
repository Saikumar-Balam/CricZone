import MatchCard from "../components/MatchCard";
import NewsCard from "../components/NewsCard";

const matches = [
  {
    status: "LIVE",
    series: "India Tour 2026",
    teams: [
      { name: "India", score: "246/4", overs: "42.3" },
      { name: "Sri Lanka", score: "—", overs: "" },
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

const news = [
  {
    title: "India announce squad for upcoming Test series",
    category: "India",
    time: "25 minutes ago",
  },
  {
    title: "Star all-rounder reaches another career milestone",
    category: "Cricket",
    time: "1 hour ago",
  },
  {
    title: "New rankings released ahead of major tournament",
    category: "Rankings",
    time: "2 hours ago",
  },
];

function Home() {
  return (
    <div className="py-8">

      {/* Hero */}
      <section className="rounded-2xl bg-green-600 px-6 py-10 text-white shadow-sm">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-green-100">
          Welcome to CricZone
        </p>

        <h1 className="text-3xl font-bold sm:text-4xl">
          Everything Cricket.
        </h1>

        <p className="mt-3 max-w-2xl text-green-50">
          Live scores, match updates, series, teams, players, statistics
          and the latest cricket news — all in one place.
        </p>
      </section>

      {/* Main content */}
      <div className="grid gap-8  lg:grid-cols-3">

        {/* Matches */}
        <section className="lg:col-span-2">

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Top Matches
            </h2>

            <button className="text-sm font-semibold text-green-600 hover:text-green-700">
              View All
            </button>
          </div>

          <div className="space-y-4">
            {matches.map((match, index) => (
              <MatchCard
                key={index}
                match={match}
              />
            ))}
          </div>

        </section>

        {/* News */}
        <section>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Latest News
            </h2>

            <button className="text-sm font-semibold text-green-600 hover:text-green-700">
              View All
            </button>
          </div>

          <div className="space-y-4">
            {news.map((item, index) => (
              <NewsCard
                key={index}
                news={item}
              />
            ))}
          </div>

        </section>

      </div>

      {/* Hot Picks */}
      <section>
        <h2 className="mb-4   text-2xl font-bold">
          Hot Picks   
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ">

          {[
            "World Test Championship",
            "Player Rankings",
            "Upcoming Fixtures",
            "Cricket Statistics",
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-gray-200  dark:bg-gray-900 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h3 className="font-semibold">{item}</h3>

              <p className="mt-2 text-sm text-gray-500">
                Explore the latest cricket updates.
              </p>
            </div>
          ))}

        </div>
      </section>

    </div>
  );
}

export default Home;
import NewsCard from "../components/NewsCard";

const news = [
  {
    id: 1,
    title: "India announce squad for upcoming Test series",
    category: "India",
    time: "25 minutes ago",
  },
  {
    id: 2,
    title: "Star all-rounder reaches another career milestone",
    category: "Cricket",
    time: "1 hour ago",
  },
  {
    id: 3,
    title: "New rankings released ahead of major tournament",
    category: "Rankings",
    time: "2 hours ago",
  },
  {
    id: 4,
    title: "Australia prepare for crucial Test series",
    category: "Australia",
    time: "3 hours ago",
  },
  {
    id: 5,
    title: "Top performers from this week's T20 matches",
    category: "T20",
    time: "4 hours ago",
  },
  {
    id: 6,
    title: "Young batter scores impressive century",
    category: "Players",
    time: "5 hours ago",
  },
];

function News() {
  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Cricket News
        </h1>

        <p className="mt-2 text-gray-500">
          Latest cricket news, updates and stories.
        </p>
      </div>

      {/* Categories */}
      <div className="flex gap-3 overflow-x-auto">

        <button className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white">
          All
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          India
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          International
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Players
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Rankings
        </button>

      </div>

      {/* News */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

        {news.map((item) => (
          <NewsCard
            key={item.id}
            news={item}
          />
        ))}

      </div>

    </div>
  );
}

export default News;
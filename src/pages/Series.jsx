import SeriesCard from "../components/SeriesCard";

const series = [
  {
    name: "India Tour of Sri Lanka 2026",
    type: "International",
    status: "Ongoing",
    matches: 3,
    country: "Sri Lanka",
  },
  {
    name: "DPL 2026",
    type: "Domestic T20",
    status: "Ongoing",
    matches: 34,
    country: "India",
  },
  {
    name: "CPL 2026",
    type: "T20 League",
    status: "Ongoing",
    matches: 34,
    country: "West Indies",
  },
  {
    name: "World Test Championship 2025-27",
    type: "Test",
    status: "Ongoing",
    matches: 70,
    country: "International",
  },
  {
    name: "The Hundred 2026",
    type: "100 Ball",
    status: "Completed",
    matches: 34,
    country: "England",
  },
  {
    name: "TNPL 2026",
    type: "T20 League",
    status: "Ongoing",
    matches: 32,
    country: "India",
  },
];

function Series() {
  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-3xl font-bold">
          Cricket Series
        </h1>

        <p className="mt-2 text-gray-500">
          Explore ongoing, upcoming and completed cricket series.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 overflow-x-auto">
        <button className="rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white">
          All
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Ongoing
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Upcoming
        </button>

        <button className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700">
          Completed
        </button>
      </div>

      {/* Series */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

        {series.map((item) => (
          <SeriesCard
            key={item.name}
            series={item}
          />
        ))}

      </div>

    </div>
  );
}

export default Series;
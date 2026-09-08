function SeriesCard({ series }) {
  return (
    <div className="rounded-xl border  dark:bg-gray-900 border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
            {series.type}
          </p>

          <h3 className="mt-2 text-lg font-bold text-gray-900">
            {series.name}
          </h3>
        </div>

        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          {series.status}
        </span>
      </div>

      <div className="mt-5 space-y-2 text-sm text-gray-500">
        <p>{series.matches} Matches</p>
        <p>{series.country}</p>
      </div>

    </div>
  );
}

export default SeriesCard;
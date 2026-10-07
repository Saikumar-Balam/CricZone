function MatchCard({ match }) {
  const statusStyles = {
    LIVE: "bg-red-100 text-red-600",
    UPCOMING: "bg-blue-100 text-blue-600",
    COMPLETED: "bg-gray-100 text-gray-600",
  };

  const formattedStartTime = match.start_time
    ? new Date(match.start_time).toLocaleString()
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:bg-gray-900">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {match.series_name}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {match.venue_name}
            {match.venue_city && `, ${match.venue_city}`}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            statusStyles[match.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {match.status}
        </span>
      </div>

      {/* Match format */}
      <div className="mt-4">
        <span className="text-xs font-semibold text-gray-500">
          {match.format}
        </span>
      </div>

      {/* Teams */}
      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">
            {match.team1_name}
          </span>

          <span className="text-xs font-semibold text-gray-500">
            {match.team1_short_name}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">
            {match.team2_name}
          </span>

          <span className="text-xs font-semibold text-gray-500">
            {match.team2_short_name}
          </span>
        </div>
      </div>

      {/* Match information */}
      <div className="mt-5 border-t border-gray-100 pt-4">
        {match.result ? (
          <p className="text-sm font-medium text-gray-600">
            {match.result}
          </p>
        ) : (
          formattedStartTime && (
            <p className="text-sm text-gray-500">
              {formattedStartTime}
            </p>
          )
        )}
      </div>

    </div>
  );
}

export default MatchCard;
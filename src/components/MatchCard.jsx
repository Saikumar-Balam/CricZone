function MatchCard({ match }) {
  const statusStyles = {
    LIVE: "bg-red-100 text-red-600",
    UPCOMING: "bg-blue-100 text-blue-600",
    COMPLETED: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:bg-gray-900 bg-white p-5 shadow-sm transition hover:shadow-md">

      {/* Header */}
      <div className="flex items-center justify-between">

        <div>
          <p className="text-sm font-semibold text-gray-900">
            {match.series}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {match.venue}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            statusStyles[match.status]
          }`}
        >
          {match.status}
        </span>

      </div>

      {/* Teams */}
      <div className="mt-5 space-y-4">

        {match.teams.map((team) => (
          <div
            key={team.name}
            className="flex items-center justify-between"
          >
            <span className="font-medium">
              {team.name}
            </span>

            <div className="text-right">
              {team.score && (
                <span className="font-bold">
                  {team.score}
                </span>
              )}

              {team.overs && (
                <span className="ml-2 text-xs text-gray-500">
                  ({team.overs})
                </span>
              )}
            </div>
          </div>
        ))}

      </div>

      {/* Result */}
      <div className="mt-5 border-t border-gray-100 pt-4">

        <p className="text-sm font-medium text-gray-600">
          {match.result}
        </p>

      </div>

    </div>
  );
}

export default MatchCard;
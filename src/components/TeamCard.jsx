function TeamCard({ team }) {
  return (
    <div className="rounded-xl border border-gray-200  dark:bg-gray-900  bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-700">
          {team.shortName}
        </div>

        <div>
          <h3 className="font-bold text-gray-900">
            {team.name}
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {team.country}
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-between border-t border-gray-100 pt-4 text-sm">
        <span className="text-gray-500">
          Matches
        </span>

        <span className="font-semibold">
          {team.matches}
        </span>
      </div>

    </div>
  );
}

export default TeamCard;
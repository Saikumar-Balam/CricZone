function PlayerCard({ player }) {
  return (
    <div className="rounded-xl border  dark:bg-gray-900 border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">

      <div className="flex items-center gap-4">

        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
          {player.initials}
        </div>

        <div>
          <h3 className="font-bold text-gray-900">
            {player.name}
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {player.role}
          </p>
        </div>

      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">

        <span className="text-sm text-gray-500">
          {player.team}
        </span>

        <span className="text-sm font-semibold text-green-600">
          {player.country}
        </span>

      </div>

    </div>
  );
}

export default PlayerCard;
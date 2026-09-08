function SeriesDetails() {
  return (
    <div className="space-y-6">

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-green-600">
          International
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          India Tour of Sri Lanka 2026
        </h1>

        <p className="mt-2 text-gray-500">
          3 Matches • Sri Lanka
        </p>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">

        <h2 className="text-xl font-bold">
          Series Matches
        </h2>

        <div className="mt-5 space-y-3">

          <div className="rounded-lg bg-gray-50 p-4">
            1st Test — India vs Sri Lanka
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            2nd Test — India vs Sri Lanka
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            3rd Test — India vs Sri Lanka
          </div>

        </div>

      </section>

    </div>
  );
}

export default SeriesDetails;
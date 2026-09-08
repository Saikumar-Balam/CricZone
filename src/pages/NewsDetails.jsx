function NewsDetails() {
  return (
    <article className="mx-auto max-w-4xl space-y-6">

      {/* Category */}
      <div>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
          India
        </span>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
        India announce squad for upcoming Test series
      </h1>

      {/* Metadata */}
      <div className="border-b border-gray-200 pb-5 text-sm text-gray-500">
        Published 25 minutes ago
      </div>

      {/* Image Placeholder */}
      <div className="flex h-64 items-center justify-center rounded-2xl bg-gray-200 text-gray-500 sm:h-96">
        News Image
      </div>

      {/* Content */}
      <div className="space-y-5 text-base leading-8 text-gray-700">

        <p>
          India have announced their squad for the upcoming Test series.
          The team will be looking to build momentum ahead of the next
          major international assignment.
        </p>

        <p>
          Several key players are expected to play important roles during
          the series, while young players will also be looking to make
          their mark.
        </p>

        <p>
          The series promises to be an important contest for both teams
          and cricket fans can follow live scores, commentary and
          statistics on CricZone.
        </p>

      </div>

    </article>
  );
}

export default NewsDetails;
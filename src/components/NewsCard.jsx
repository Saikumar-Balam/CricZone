import { Link } from "react-router-dom";

function NewsCard({ news }) {
  return (
    <article className="rounded-xl border dark:bg-gray-900  border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">

      <div className="mb-4 flex items-center justify-between">

        <span className="rounded-full dark:text-red-400 bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">
          {news.category}
        </span>

        <span className="text-xs text-gray-400 dark:text-white">
          {news.time}
        </span>

      </div>

      <h3 className="text-lg font-bold leading-6 text-gray-900 dark:text-white">
        {news.title}
      </h3>

      <Link
        to={`/news/${news.id}`}
        className="mt-4 inline-block text-sm font-semibold dark:text-white text-green-600 hover:text-green-700"
      >
        Read More →
      </Link>

    </article>
  );
}

export default NewsCard;
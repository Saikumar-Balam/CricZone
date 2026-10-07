import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import MatchCard from "../components/MatchCard";
import NewsCard from "../components/NewsCard";
import matchService from "../services/match.service";

const news = [
  {
    title: "India announce squad for upcoming Test series",
    category: "India",
    time: "25 minutes ago",
  },
  {
    title: "Star all-rounder reaches another career milestone",
    category: "Cricket",
    time: "1 hour ago",
  },
  {
    title: "New rankings released ahead of major tournament",
    category: "Rankings",
    time: "2 hours ago",
  },
];

function Home() {
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [matchesError, setMatchesError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      try {
        setMatchesLoading(true);
        setMatchesError(null);

        const data = await matchService.getAllMatches();

        if (!cancelled) {
          setMatches(data);
        }
      } catch (error) {
        if (!cancelled) {
          setMatchesError(
            error.message || "Failed to load matches"
          );
        }
      } finally {
        if (!cancelled) {
          setMatchesLoading(false);
        }
      }
    }

    loadMatches();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="py-8">

      {/* Hero */}
      <section className="rounded-2xl bg-green-600 px-6 py-10 text-white shadow-sm">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-green-100">
          Welcome to CricZone
        </p>

        <h1 className="text-3xl font-bold sm:text-4xl">
          Everything Cricket.
        </h1>

        <p className="mt-3 max-w-2xl text-green-50">
          Live scores, match updates, series, teams, players, statistics
          and the latest cricket news — all in one place.
        </p>
      </section>

      {/* Main content */}
      <div className="grid gap-8 lg:grid-cols-3">

        {/* Matches */}
        <section className="lg:col-span-2">

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Top Matches
            </h2>

            <Link
              to="/matches"
              className="text-sm font-semibold text-green-600 hover:text-green-700"
            >
              View All
            </Link>
          </div>

          {matchesLoading && (
            <p className="text-sm text-gray-500">
              Loading matches...
            </p>
          )}

          {!matchesLoading && matchesError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-600">
                {matchesError}
              </p>
            </div>
          )}

          {!matchesLoading &&
            !matchesError &&
            matches.length > 0 && (
              <div className="space-y-4">
                {matches.slice(0, 3).map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                  />
                ))}
              </div>
            )}

          {!matchesLoading &&
            !matchesError &&
            matches.length === 0 && (
              <p className="text-sm text-gray-500">
                No matches available.
              </p>
            )}

        </section>

        {/* News */}
        <section>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              Latest News
            </h2>

            <Link
              to="/news"
              className="text-sm font-semibold text-green-600 hover:text-green-700"
            >
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {news.map((item, index) => (
              <NewsCard
                key={index}
                news={item}
              />
            ))}
          </div>

        </section>

      </div>

      {/* Hot Picks */}
      <section>
        <h2 className="mb-4 text-2xl font-bold">
          Hot Picks
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {[
            "World Test Championship",
            "Player Rankings",
            "Upcoming Fixtures",
            "Cricket Statistics",
          ].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:bg-gray-900"
            >
              <h3 className="font-semibold">
                {item}
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Explore the latest cricket updates.
              </p>
            </div>
          ))}

        </div>
      </section>

    </div>
  );
}

export default Home;
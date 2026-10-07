import { useEffect, useMemo, useState } from "react";
import MatchCard from "../components/MatchCard";
import matchService from "../services/match.service";

const FILTERS = ["ALL", "LIVE", "UPCOMING", "COMPLETED"];

function Matches() {
  const [matches, setMatches] = useState([]);
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMatches() {
      try {
        setLoading(true);
        setError(null);

        const data = await matchService.getAllMatches();

        if (!cancelled) {
          setMatches(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load matches");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMatches();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMatches = useMemo(() => {
    if (selectedFilter === "ALL") {
      return matches;
    }

    return matches.filter(
      (match) => match.status === selectedFilter
    );
  }, [matches, selectedFilter]);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          Cricket Matches
        </h1>

        <p className="mt-2 text-gray-500">
          Follow live, upcoming and completed cricket matches.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 overflow-x-auto">
        {FILTERS.map((filter) => {
          const active = selectedFilter === filter;

          return (
            <button
              key={filter}
              type="button"
              onClick={() => setSelectedFilter(filter)}
              className={
                active
                  ? "rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white"
                  : "rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm font-semibold text-gray-700"
              }
            >
              {filter === "ALL"
                ? "All"
                : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-sm text-gray-500">
          Loading matches...
        </p>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-600">
            {error}
          </p>
        </div>
      )}

      {/* Matches */}
      {!loading && !error && filteredMatches.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {filteredMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredMatches.length === 0 && (
        <p className="text-sm text-gray-500">
          No matches found.
        </p>
      )}

    </div>
  );
}

export default Matches;
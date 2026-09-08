import { Link } from "react-router-dom";
import { useState } from "react";
import ThemeToggle from "./ThemeToogle";

function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <nav
      className="
        border-b border-gray-200
        
        dark:border-gray-700
        bg-[#1A2938]
        transition-colors duration-300
      "
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <Link
          to="/"
          className="text-2xl font-bold text-green-600"
        >
          CricZone
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-6 text-sm font-medium">

          <Link
            to="/"
            className="text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
          >
            Home
          </Link>

          <Link
            to="/series"
            className="text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
          >
            Series
          </Link>

          <Link
            to="/teams"
            className="text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
          >
            Teams
          </Link>

          <Link
            to="/matches"
            className="text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
          >
            Fixtures
          </Link>

          <Link
            to="/stats"
            className="text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
          >
            Stats
          </Link>

          <Link
            to="/rankings"
            className="text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
          >
            Rankings
          </Link>

          <Link
            to="/news"
            className="text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
          >
            News
          </Link>

          {/* Search */}
          <div className="flex items-center">
            {searchOpen && (
              <input
                autoFocus
                type="text"
                placeholder="Search..."
                className="
                  w-48 rounded-lg border
                  border-gray-300
                  bg-white
                  px-3 py-2
                  text-gray-900
                  outline-none

                  dark:border-gray-600
                  dark:bg-gray-800
                  dark:text-white
                  dark:placeholder-gray-400

                  focus:border-green-500
                "
              />
            )}

            <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="ml-2 text-gray-700 hover:text-green-600 dark:text-gray-200 dark:hover:text-green-400 transition-colors"
            >
              Search
            </button>
          </div>

          {/* Global Theme Toggle */}
          <ThemeToggle />

        </div>
      </div>
    </nav>
  );
}

export default Navbar;
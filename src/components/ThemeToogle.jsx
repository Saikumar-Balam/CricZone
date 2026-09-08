import React from "react";

const ThemeToggle = () => {
  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="
        rounded-lg px-3 py-2 text-sm font-medium
        bg-gray-100 text-gray-800
        hover:bg-gray-200
        dark:bg-gray-800 dark:text-gray-200
        dark:hover:bg-gray-700
        transition-colors
      "
    >
      <span className="dark:hidden">☾ Dark</span>
      <span className="hidden dark:inline">☀ Bright</span>
    </button>
  );
};

export default ThemeToggle;
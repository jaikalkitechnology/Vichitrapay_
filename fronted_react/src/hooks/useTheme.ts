import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

/** localStorage key for the light/dark choice; index.html applies it before first paint. */
export const THEME_KEY = "vichitrapay-theme";

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Shared light/dark theme state — toggles the `dark` class on <html> and remembers the choice. */
export default function useTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // storage unavailable (private mode) — theme lasts for this page only
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  return { theme, toggleTheme };
}

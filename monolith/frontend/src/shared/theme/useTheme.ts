import { useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";
const KEY = "groupsapp_theme";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const initial = useMemo<Theme>(() => {
    const saved = localStorage.getItem(KEY);
    return saved === "dark" || saved === "light" ? saved : "dark";
  }, []);

  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    setTheme,
  };
}
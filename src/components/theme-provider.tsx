import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "auto" | "productivity" | "sleep";
export type ResolvedTheme = "productivity" | "sleep";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "sleepio.theme";

function resolveAuto(): ResolvedTheme {
  if (typeof Date === "undefined") return "productivity";
  const h = new Date().getHours();
  // Sleep theme between 8pm and 6am
  return h >= 20 || h < 6 ? "sleep" : "productivity";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [resolved, setResolved] = useState<ResolvedTheme>("productivity");

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY)) as ThemeMode | null;
    if (stored === "auto" || stored === "productivity" || stored === "sleep") {
      setModeState(stored);
    }
  }, []);

  useEffect(() => {
    const next: ResolvedTheme = mode === "auto" ? resolveAuto() : mode;
    setResolved(next);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.remove("sleep", "dark");
      if (next === "sleep") root.classList.add("sleep");
    }

    if (mode !== "auto") return;
    const id = window.setInterval(() => {
      const r = resolveAuto();
      setResolved((prev) => (prev === r ? prev : r));
      const root = document.documentElement;
      root.classList.remove("sleep", "dark");
      if (r === "sleep") root.classList.add("sleep");
    }, 60_000);
    return () => window.clearInterval(id);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
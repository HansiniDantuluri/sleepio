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

const DEFAULT_SLEEP_GOAL = "22:00";
const DEFAULT_WAKE = "06:00";

function parseHHMM(value: string | null | undefined, fallback: string): number {
  const raw = value ?? fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(raw);
  const src = m ? raw : fallback;
  const [h, mm] = src.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(mm)) {
    const [fh, fm] = fallback.split(":").map(Number);
    return fh * 60 + fm;
  }
  return ((h % 24) * 60 + (mm % 60));
}

function resolveAuto(): ResolvedTheme {
  if (typeof Date === "undefined") return "productivity";
  let sleepGoal = DEFAULT_SLEEP_GOAL;
  let wake = DEFAULT_WAKE;
  if (typeof localStorage !== "undefined") {
    sleepGoal = localStorage.getItem("sleep_goal_time") ?? DEFAULT_SLEEP_GOAL;
    wake = localStorage.getItem("wake_time") ?? DEFAULT_WAKE;
  }
  const sleepGoalMin = parseHHMM(sleepGoal, DEFAULT_SLEEP_GOAL);
  const wakeMin = parseHHMM(wake, DEFAULT_WAKE);
  const sleepStart = (sleepGoalMin - 60 + 1440) % 1440;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Interval [sleepStart, wakeMin) on a 24h clock; handle wrap.
  const inSleep =
    sleepStart < wakeMin
      ? nowMin >= sleepStart && nowMin < wakeMin
      : nowMin >= sleepStart || nowMin < wakeMin;
  return inSleep ? "sleep" : "productivity";
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
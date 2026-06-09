import { Moon, Sun, Clock } from "lucide-react";
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
const SLEEP_GOAL_KEY = "sleep_goal_time";
const WAKE_KEY = "wake_time";
const DEFAULT_SLEEP_GOAL = "22:00";
const DEFAULT_WAKE = "06:00";

function parseHHMM(v: string | null, fallback: string): number {
  const s = v && /^\d{1,2}:\d{2}$/.test(v) ? v : fallback;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function readSchedule() {
  if (typeof localStorage === "undefined") {
    return { sleepStart: parseHHMM(null, DEFAULT_SLEEP_GOAL) - 60, wake: parseHHMM(null, DEFAULT_WAKE) };
  }
  const goal = parseHHMM(localStorage.getItem(SLEEP_GOAL_KEY), DEFAULT_SLEEP_GOAL);
  const wake = parseHHMM(localStorage.getItem(WAKE_KEY), DEFAULT_WAKE);
  // Switch to sleep mode 1 hour BEFORE sleep_goal_time
  const sleepStart = (goal - 60 + 24 * 60) % (24 * 60);
  return { sleepStart, wake };
}

function resolveAuto(): ResolvedTheme {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const { sleepStart, wake } = readSchedule();
  // Sleep window wraps around midnight when sleepStart > wake (typical case)
  const inSleep = sleepStart > wake
    ? mins >= sleepStart || mins < wake
    : mins >= sleepStart && mins < wake;
  return inSleep ? "sleep" : "productivity";
}

function applyClass(theme: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("sleep", "dark");
  if (theme === "sleep") root.classList.add("sleep");
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
    const evaluate = () => {
      const next: ResolvedTheme = mode === "auto" ? resolveAuto() : mode;
      setResolved(next);
      applyClass(next);
    };
    evaluate();

    if (mode !== "auto") return;
    const id = window.setInterval(evaluate, 60_000);
    // Re-evaluate when sleep/wake times change in another tab or after onboarding
    const onStorage = (e: StorageEvent) => {
      if (e.key === SLEEP_GOAL_KEY || e.key === WAKE_KEY || e.key === null) evaluate();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("sleepio:schedule-changed", evaluate);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sleepio:schedule-changed", evaluate);
    };
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
  return (
    <ThemeContext.Provider value={value}>
      {children}
      <ThemeToggle />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const options: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "productivity", label: "Day", icon: Sun },
    { value: "auto", label: "Auto", icon: Clock },
    { value: "sleep", label: "Night", icon: Moon },
  ];
  return (
    <div className="fixed right-3 top-3 z-50 flex items-center gap-1 rounded-full border border-border/60 bg-surface/80 p-1 shadow-sm backdrop-blur">
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-label={`Theme: ${opt.label}`}
            aria-pressed={active}
            onClick={() => setMode(opt.value)}
            className={
              "inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
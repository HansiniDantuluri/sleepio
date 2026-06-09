import { Moon, Sun, SunMoon } from "lucide-react";
import { useTheme, type ThemeMode } from "./theme-provider";

const NEXT: Record<ThemeMode, ThemeMode> = {
  auto: "productivity",
  productivity: "sleep",
  sleep: "auto",
};

const LABEL: Record<ThemeMode, string> = {
  auto: "Auto",
  productivity: "Day",
  sleep: "Night",
};

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const Icon = mode === "sleep" ? Moon : mode === "productivity" ? Sun : SunMoon;
  return (
    <button
      type="button"
      onClick={() => setMode(NEXT[mode])}
      aria-label={`Theme: ${LABEL[mode]} (tap to change)`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-[0_1px_0_0_var(--border)] transition-colors hover:bg-accent"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{LABEL[mode]}</span>
    </button>
  );
}
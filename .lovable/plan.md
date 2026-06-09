# Fix: Theme toggle + configurable auto-switch

## Issue 1 — Manual toggle does not switch visually

### Root cause
`ThemeProvider` (`src/components/theme-provider.tsx`) exposes `useTheme().setMode`, and correctly adds/removes the `.sleep` class on `<html>` whenever `mode` changes. A grep of `src/` for `useTheme`/`setMode` returns **only the provider file**. No UI surface ever calls `setMode`, so the user has nothing to click — the "toggle" effectively doesn't exist. It's not a CSS or class-application bug.

### Minimal fix
Add a single theme-toggle control and wire it through the existing `AppShell` header `action` slot.

**Files to change:**

1. **`src/components/theme-toggle.tsx` (new, ~30 lines)**
   - Client component using `useTheme()`.
   - Cycles `auto → productivity → sleep → auto` on click.
   - Renders a small pill button showing the current mode with a sun/moon/auto icon (lucide-react `Sun`, `Moon`, `SunMoon`).
   - Uses semantic tokens only (`bg-surface`, `text-foreground`, `border-border`).

2. **`src/components/app-shell.tsx`**
   - Import `ThemeToggle`.
   - Render it inside the header by default (when no custom `action` prop is passed), so every screen gets the toggle without per-route wiring. Header rendering condition already shows when `title || action` is truthy — adjust to always render header (or pass default action).
   - Two-line change in the component body.

No change to `theme-provider.tsx` or `styles.css` is required to make manual switching work.

## Issue 2 — Auto-switch should read `sleep_goal_time` and `wake_time` from localStorage

### Root cause
`resolveAuto()` in `src/components/theme-provider.tsx` hardcodes `h >= 20 || h < 6`.

### Minimal fix — single-file change to `src/components/theme-provider.tsx`

Rewrite `resolveAuto()` to:

1. Read two localStorage keys:
   - `sleep_goal_time` (string `"HH:MM"`, 24-hr) — default `"22:00"`
   - `wake_time` (string `"HH:MM"`, 24-hr) — default `"06:00"`
2. Parse each into minutes-since-midnight. If parse fails, fall back to the defaults.
3. Compute `sleepStart = sleepGoalMinutes - 60` (1 hour before sleep goal); wrap modulo 1440.
4. Compute `nowMinutes = hours*60 + minutes` from `new Date()`.
5. Return `"sleep"` if `nowMinutes` lies in the wraparound interval `[sleepStart, wakeMinutes)`, else `"productivity"`. Helper: handle the wrap (sleepStart > wakeMinutes is the common case).

No other files change. The existing 60-second `setInterval` in the provider already re-evaluates, so updates to localStorage are picked up within a minute (acceptable — sleep/wake times are edited rarely). No event listener needed for MVP.

### Defaults verification
- `sleep_goal_time="22:00"`, `wake_time="06:00"` → sleep mode active 21:00–06:00. Matches the spec ("1 hour before 10pm, wake at 6am").

## Files changed (summary)

| File | Change |
|---|---|
| `src/components/theme-toggle.tsx` | **new** — toggle button using `useTheme()` |
| `src/components/app-shell.tsx` | render `<ThemeToggle />` in header as default action |
| `src/components/theme-provider.tsx` | replace `resolveAuto()` body to read `sleep_goal_time` / `wake_time` from localStorage with defaults |

## Out of scope
- Settings UI for editing `sleep_goal_time` / `wake_time` (lands in a later phase; this fix only consumes the keys).
- Cross-tab `storage` event sync (60s polling is sufficient for MVP).
- Persisting resolved theme to SSR — current provider is client-only, unchanged.

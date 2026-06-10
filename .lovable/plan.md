## Scope
Edit `src/components/sleep-overlay.tsx` only.

## Changes

### 1. Remove daytime guard
Replace the `if (hour >= 3 && hour < 18)` block (line 48) with a 3am cutoff only: `if (hour >= 3 && hour < 12) return` so the overlay can appear any time the user is past their bedtime, while still hiding between 3am and noon (assume they slept).

The existing `passed = now >= target || hour < 3` already covers "passed by ≥1 minute" and the post-midnight wrap. No further change to the time check needed.

### 2. Read `sleep_goal_time` from Supabase as fallback
- Import `getSettings` from `../lib/api/settings.functions` and wire `useServerFn(getSettings)`.
- In `check()`: read localStorage first. If empty/null, `await fetchSettings()` and use `res.profile.sleep_goal_time` (stored as `HH:MM:SS` on `profiles`, sliced to `HH:MM`). Write the result back to localStorage so subsequent ticks stay fast.
- On failure (offline/unauth), fall through to the existing `[22, 0]` default.

Note: `sleep_goal_time` lives on `profiles`, not `user_settings`, and `getSettings()` already returns it as `res.profile.sleep_goal_time`. No new server function needed.

### 3. Raise z-index + confirm button visibility
- Change overlay wrapper from `z-[80]` to `z-[9999]`.
- The existing markup already renders Moon icon → "It's sleep time, {name}" heading → "Put your phone down…" subtitle → large white pill `Sleep Now` button → "Dismiss for 30 min" text link. No structural changes required; just leave that block intact.

## Out of scope
No other files touched. No changes to mount point in `src/routes/index.tsx`, settings persistence, or sleep-session APIs.
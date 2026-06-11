import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X, Moon } from "lucide-react";
import { toast } from "sonner";
import {
  getActiveSleepSession,
  getLatestSleepSession,
  startSleepSession,
} from "../lib/api/sleep.functions";
import { getStatsData, type StatsSession } from "../lib/api/stats.functions";
import { getSettings } from "../lib/api/settings.functions";

export type NudgeStage = "s1" | "s2" | "s3" | "s4" | "s5" | "s6";

export type NudgeData = {
  stage: NudgeStage;
  title: string;
  message: string;
  to: string;
  border: string;
  bg: string;
  autoDismissMs: number | null; // null = persistent
  showCommit: boolean;
  pulse: boolean;
};

export type SleepStats = {
  debtMin: number;
  streak: number;
  yesterdayMin: number | null;
  yesterdayTargetMin: number | null;
  avgEnergy: number | null;
};

export const FORCE_OVERLAY_EVENT = "sleepio:force-overlay";

export function parseHHMM(value: string | null | undefined, fallback: [number, number]): [number, number] {
  if (!value) return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return fallback;
  return [Number(m[1]), Number(m[2])];
}

export function getOnboardingName(): string {
  try {
    const draft = JSON.parse(localStorage.getItem("onboarding_draft") || "{}");
    return draft.name || "";
  } catch {
    return "";
  }
}

export function nightKey(d: Date = new Date()) {
  // Reset at 6am — a "night" runs 6am-6am
  const shifted = new Date(d.getTime() - 6 * 3600 * 1000);
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

export function formatTime(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${period}`;
}

export function formatHM(totalMin: number) {
  const m = Math.max(0, Math.round(totalMin));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

/** Resolve sleep_goal_time at mount: localStorage → Supabase profile → default 22:00. */
export function useSleepGoalTime(): { h: number; m: number; ready: boolean } {
  const fetchSettings = useServerFn(getSettings);
  const [state, setState] = useState<{ h: number; m: number; ready: boolean }>(
    () => {
      if (typeof window === "undefined") return { h: 22, m: 0, ready: false };
      const stored = localStorage.getItem("sleep_goal_time");
      if (stored) {
        const [h, m] = parseHHMM(stored, [22, 0]);
        return { h, m, ready: true };
      }
      return { h: 22, m: 0, ready: false };
    },
  );

  useEffect(() => {
    if (state.ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchSettings();
        const fromDb = res?.profile?.sleep_goal_time ?? null;
        if (fromDb && !cancelled) {
          const sliced = String(fromDb).slice(0, 5);
          localStorage.setItem("sleep_goal_time", sliced);
          const [h, m] = parseHHMM(sliced, [22, 0]);
          setState({ h, m, ready: true });
          return;
        }
      } catch {
        /* default */
      }
      if (!cancelled) setState({ h: 22, m: 0, ready: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchSettings, state.ready]);

  return state;
}

function computeStats(sessions: StatsSession[]): SleepStats {
  // Most recent first
  const completed = sessions
    .filter((s) => s.end_time && s.start_time)
    .sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    );

  const tonightKey = nightKey(new Date());
  let debtMin = 0;
  let countedForDebt = 0;
  let energySum = 0;
  let energyCount = 0;
  for (const s of completed) {
    if (countedForDebt >= 7) break;
    const actual =
      (new Date(s.end_time!).getTime() - new Date(s.start_time).getTime()) /
      60000;
    const target = s.target_minutes ?? 480;
    debtMin += Math.max(0, target - actual);
    countedForDebt += 1;
    if (s.mood_score != null && energyCount < 7) {
      energySum += s.mood_score;
      energyCount += 1;
    }
  }

  // Yesterday — most recent completed session NOT from tonight's night key
  const lastPrev = completed.find(
    (s) => nightKey(new Date(s.start_time)) !== tonightKey,
  );
  const yesterdayMin = lastPrev
    ? Math.round(
        (new Date(lastPrev.end_time!).getTime() -
          new Date(lastPrev.start_time).getTime()) /
          60000,
      )
    : null;
  const yesterdayTargetMin = lastPrev?.target_minutes ?? null;

  // Streak — consecutive previous nights where actual >= target
  let streak = 0;
  const cursor = new Date();
  // start from yesterday
  cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const k = nightKey(cursor);
    const match = completed.find((s) => nightKey(new Date(s.start_time)) === k);
    if (!match || !match.end_time) break;
    const actual =
      (new Date(match.end_time).getTime() -
        new Date(match.start_time).getTime()) /
      60000;
    const target = match.target_minutes ?? 480;
    if (actual + 0.5 < target) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 365) break;
  }

  return {
    debtMin: Math.round(debtMin),
    streak,
    yesterdayMin,
    yesterdayTargetMin,
    avgEnergy: energyCount > 0 ? energySum / energyCount : null,
  };
}

export function useSleepStats(): SleepStats {
  const fetchStats = useServerFn(getStatsData);
  const [stats, setStats] = useState<SleepStats>({
    debtMin: 0,
    streak: 0,
    yesterdayMin: null,
    yesterdayTargetMin: null,
    avgEnergy: null,
  });
  useEffect(() => {
    let cancelled = false;
    fetchStats()
      .then((r) => {
        if (cancelled) return;
        setStats(computeStats(r.sessions ?? []));
      })
      .catch(() => {});
    const id = window.setInterval(() => {
      fetchStats()
        .then((r) => !cancelled && setStats(computeStats(r.sessions ?? [])))
        .catch(() => {});
    }, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fetchStats]);
  return stats;
}

async function sendWebPush(title: string, body: string, to: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const opts: NotificationOptions = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: to },
    tag: "sleepio-nudge",
  };
  // Prefer service worker so click handling works when app is closed.
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, opts);
        return;
      }
    } catch {
      /* fall back to ctor */
    }
  }
  try {
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      window.location.href = to;
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function useSleepNudge() {
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const [permissionPrompt, setPermissionPrompt] = useState(false);
  const fetchActive = useServerFn(getActiveSleepSession);
  const fetchLatest = useServerFn(getLatestSleepSession);
  const goal = useSleepGoalTime();
  const stats = useSleepStats();
  const checkingRef = useRef(false);
  const goalRef = useRef(goal);
  const statsRef = useRef(stats);
  useEffect(() => { goalRef.current = goal; }, [goal]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  const dismiss = useCallback(() => setNudge(null), []);

  // One-time permission prompt
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const asked = localStorage.getItem("push_permission_asked");
    if (!asked && Notification.permission === "default") {
      // Slight delay so dashboard loads first
      const t = window.setTimeout(() => setPermissionPrompt(true), 3000);
      return () => window.clearTimeout(t);
    }
  }, []);

  const allowPermission = useCallback(async () => {
    localStorage.setItem("push_permission_asked", "1");
    setPermissionPrompt(false);
    if ("Notification" in window) {
      try {
        await Notification.requestPermission();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const denyPermission = useCallback(() => {
    localStorage.setItem("push_permission_asked", "1");
    setPermissionPrompt(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const g = goalRef.current;
        if (!g.ready) return;
        const now = new Date();
        const hour = now.getHours();
        // Stop all nudges past 3am up until 6am (assume they fell asleep)
        if (hour >= 3 && hour < 6) return;

        // Check if a sleep session has been started today
        let sleptToday = false;
        try {
          const [active, latest] = await Promise.all([fetchActive(), fetchLatest()]);
          const dayK = nightKey(now);
          const activeStart = active?.session?.start_time
            ? nightKey(new Date(active.session.start_time))
            : null;
          const latestStart = latest?.session?.start_time
            ? nightKey(new Date(latest.session.start_time))
            : null;
          if (activeStart === dayK || latestStart === dayK) sleptToday = true;
        } catch {
          /* unauth or offline — proceed without */
        }
        if (sleptToday) return;

        const sh = g.h;
        const sm = g.m;
        const target = new Date(now);
        target.setHours(sh, sm, 0, 0);
        const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
        const lateMin = Math.max(0, -diffMin);

        const s = statsRef.current;
        const dayK = nightKey(now);
        const wasSent = (st: NudgeStage) =>
          localStorage.getItem(`nudge_${dayK}_${st}`) === "1";
        const markSent = (st: NudgeStage) =>
          localStorage.setItem(`nudge_${dayK}_${st}`, "1");

        const timeStr = formatTime(sh, sm);
        const remainingNow = (() => {
          // hours from now to default wake (7am next day if before, else 7am same day if early-morn)
          const wake = new Date(now);
          wake.setHours(7, 0, 0, 0);
          if (wake.getTime() <= now.getTime()) wake.setDate(wake.getDate() + 1);
          return Math.max(0, (wake.getTime() - now.getTime()) / 60000);
        })();
        const remainingIn30 = Math.max(0, remainingNow - 30);
        const debtStr = formatHM(s.debtMin);

        let candidate: NudgeData | null = null;

        // Choose latest applicable stage that hasn't been sent.
        if (diffMin <= -45 && !wasSent("s6")) {
          candidate = {
            stage: "s6",
            title: "SleepIO — Final Reminder",
            message: `You've sacrificed ${lateMin} minutes of recovery sleep tonight. Press Commit to Sleep.`,
            to: "/sleep",
            border: "oklch(0.6 0.25 25)",
            bg: "rgba(80, 10, 10, 0.96)",
            autoDismissMs: null,
            showCommit: true,
            pulse: true,
          };
        } else if (diffMin <= -30 && diffMin > -45 && !wasSent("s5")) {
          candidate = {
            stage: "s5",
            title: "SleepIO",
            message: `The version of you tomorrow wants you to stop scrolling. ${debtStr} sleep debt this week. Commit to Sleep now.`,
            to: "/sleep",
            border: "oklch(0.6 0.25 25)",
            bg: "rgba(60, 10, 10, 0.95)",
            autoDismissMs: null,
            showCommit: true,
            pulse: true,
          };
        } else if (diffMin <= -15 && diffMin > -30 && !wasSent("s4")) {
          candidate = {
            stage: "s4",
            title: "SleepIO — 15 Minutes Lost",
            message: `You've lost 15 minutes of sleep already. That's ${debtStr} lost this week. ${s.streak} day streak at risk.`,
            to: "/sleep",
            border: "oklch(0.6 0.25 25)",
            bg: "rgba(50, 10, 10, 0.95)",
            autoDismissMs: null,
            showCommit: true,
            pulse: false,
          };
        } else if (diffMin <= 0 && diffMin > -15 && !wasSent("s3")) {
          const missedYesterday =
            s.yesterdayMin != null &&
            s.yesterdayTargetMin != null &&
            s.yesterdayMin < s.yesterdayTargetMin;
          const body = missedYesterday
            ? `You missed your target last night. Sleeping now gets you back on track. Current streak: ${s.streak} days.`
            : `You're on a ${s.streak} day streak. Sleep now to keep it alive 🔥`;
          candidate = {
            stage: "s3",
            title: "SleepIO — Sleep Time",
            message: body,
            to: "/sleep",
            border: "oklch(0.25 0.08 270)",
            bg: "rgba(15, 10, 40, 0.97)",
            autoDismissMs: null,
            showCommit: true,
            pulse: false,
          };
        } else if (diffMin <= 10 && diffMin > 0 && !wasSent("s2")) {
          candidate = {
            stage: "s2",
            title: "SleepIO — Wind Down",
            message: `Sleeping now = ${formatHM(remainingNow)} sleep. Waiting 30 more minutes = ${formatHM(remainingIn30)}. You have ${debtStr} sleep debt this week.`,
            to: "/wind-down",
            border: "oklch(0.7 0.18 50)",
            bg: "rgba(40, 25, 5, 0.95)",
            autoDismissMs: 10000,
            showCommit: false,
            pulse: false,
          };
        } else if (diffMin <= 30 && diffMin > 10 && !wasSent("s1")) {
          candidate = {
            stage: "s1",
            title: "SleepIO",
            message: `Your target sleep time is ${timeStr}. Sleeping now gives you ${formatHM(remainingNow)} of sleep tonight.`,
            to: "/wind-down",
            border: "oklch(0.7 0.18 250)",
            bg: "rgba(15, 25, 50, 0.95)",
            autoDismissMs: 8000,
            showCommit: false,
            pulse: false,
          };
        }

        if (cancelled || !candidate) return;
        markSent(candidate.stage);
        setNudge(candidate);
        if (candidate.stage === "s6" && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(FORCE_OVERLAY_EVENT));
        }
        void sendWebPush(candidate.title, candidate.message, candidate.to);
      } finally {
        checkingRef.current = false;
      }
    };

    // Initial + interval
    void check();
    const id = window.setInterval(check, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fetchActive, fetchLatest]);

  return { nudge, dismiss, permissionPrompt, allowPermission, denyPermission };
}

export function SleepNudgeBanner({
  nudge,
  onDismiss,
}: {
  nudge: NudgeData | null;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();
  const startFn = useServerFn(startSleepSession);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    if (!nudge || nudge.autoDismissMs == null) return;
    const id = window.setTimeout(onDismiss, nudge.autoDismissMs);
    return () => window.clearTimeout(id);
  }, [nudge, onDismiss]);

  const commit = useCallback(async () => {
    if (committing) return;
    setCommitting(true);
    try {
      await startFn({ data: {} });
      toast.success("Sleep session started. Good night 💙");
      onDismiss();
      try {
        navigate({ to: "/sleep" });
      } catch {
        if (typeof window !== "undefined") window.location.href = "/sleep";
      }
      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          if (window.location.pathname !== "/sleep") {
            window.location.href = "/sleep";
          }
        }, 300);
      }
    } catch {
      toast.error("Couldn't start sleep session");
    } finally {
      setCommitting(false);
    }
  }, [committing, startFn, onDismiss, navigate]);

  return (
    <AnimatePresence>
      {nudge && (
        <motion.div
          key={nudge.stage}
          initial={{ y: -80, opacity: 0 }}
          animate={nudge.pulse ? { y: 0, opacity: [1, 0.7, 1] } : { y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={
            nudge.pulse
              ? { opacity: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }, y: { type: "spring", stiffness: 320, damping: 28 } }
              : { type: "spring", stiffness: 320, damping: 28 }
          }
          className="fixed left-3 right-3 top-3 z-[60] mx-auto max-w-md"
        >
          <div
            className="rounded-2xl p-3 pl-4 shadow-xl"
            style={{
              background: nudge.bg,
              color: "#ffffff",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderLeft: `4px solid ${nudge.border}`,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="cursor-pointer"
                onClick={() => {
                  navigate({ to: nudge.to });
                  onDismiss();
                }}
                role="button"
                tabIndex={0}
              >
                <p
                  className="text-xs uppercase tracking-wide opacity-70"
                  style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600 }}
                >
                  {nudge.title}
                </p>
                <p
                  className="mt-1 leading-snug"
                  style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff" }}
                >
                  {nudge.message}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="ml-auto shrink-0 rounded-full p-1 hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.8)" }}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {nudge.showCommit && (
              <button
                type="button"
                onClick={commit}
                disabled={committing}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-0 transition active:scale-[0.98]"
                style={{
                  background: "#ffffff",
                  color: "#0f0a28",
                  fontSize: "15px",
                  fontWeight: 700,
                  padding: "12px 16px",
                  minHeight: 44,
                }}
              >
                <Moon className="h-4 w-4" />
                {committing ? "Starting…" : "Commit to Sleep"}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PushPermissionCard({
  onAllow,
  onDeny,
}: {
  onAllow: () => void;
  onDeny: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border border-border bg-surface p-4"
    >
      <p className="text-sm font-semibold text-foreground">
        Get sleep reminders on your phone
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Luna will nudge you at the right time. Never spam.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onAllow}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Allow
        </button>
        <button
          type="button"
          onClick={onDeny}
          className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-foreground"
        >
          Not now
        </button>
      </div>
    </motion.div>
  );
}
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Moon } from "lucide-react";
import { toast } from "sonner";
import {
  getActiveSleepSession,
  getLatestSleepSession,
  startSleepSession,
} from "../lib/api/sleep.functions";
import {
  FORCE_OVERLAY_EVENT,
  getOnboardingName,
  formatHM,
  useSleepGoalTime,
  useSleepStats,
} from "./sleep-nudge";

const DISMISS_KEY = "sleep_overlay_dismissed_at";
const DISMISS_MS = 30 * 60 * 1000;

function nightKey(d: Date) {
  const shifted = new Date(d.getTime() - 6 * 3600 * 1000);
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

/**
 * Full-screen overlay shown on Home when the user's sleep_goal_time has passed
 * and they haven't started a sleep session tonight. Honors a 30-min dismiss
 * and the user_settings.app_blocking toggle.
 */
export function SleepOverlay({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate();
  const fetchActive = useServerFn(getActiveSleepSession);
  const fetchLatest = useServerFn(getLatestSleepSession);
  const startFn = useServerFn(startSleepSession);
  const goal = useSleepGoalTime();
  const stats = useSleepStats();
  const [show, setShow] = useState(false);
  const [lateMin, setLateMin] = useState(0);
  const [forced, setForced] = useState(false);
  const [committing, setCommitting] = useState(false);

  const check = useCallback(async () => {
    if (!enabled) { setShow(false); return; }
    if (!goal.ready) return;
    const now = new Date();
    const target = new Date(now);
    target.setHours(goal.h, goal.m, 0, 0);
    const passed = now.getTime() >= target.getTime();
    if (!passed) { setShow(false); return; }

    const minutesLate = Math.max(
      0,
      Math.round((now.getTime() - target.getTime()) / 60000),
    );
    setLateMin(minutesLate);

    // Dismiss only honored when under 15 min late (and not in forced mode)
    if (!forced && minutesLate < 15) {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || "0");
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) {
        setShow(false);
        return;
      }
    }

    // Skip if a sleep session has been started tonight
    try {
      const [active, latest] = await Promise.all([fetchActive(), fetchLatest()]);
      const dayK = nightKey(now);
      const activeStart = active?.session?.start_time
        ? nightKey(new Date(active.session.start_time)) : null;
      const latestStart = latest?.session?.start_time
        ? nightKey(new Date(latest.session.start_time)) : null;
      if (activeStart === dayK || latestStart === dayK) { setShow(false); return; }
    } catch {
      /* unauth/offline — still show */
    }
    setShow(true);
  }, [enabled, fetchActive, fetchLatest, goal, forced]);

  useEffect(() => {
    void check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [check]);

  // Stage-6 force trigger from sleep-nudge.
  useEffect(() => {
    const handler = () => {
      setForced(true);
      void check();
    };
    window.addEventListener(FORCE_OVERLAY_EVENT, handler);
    return () => window.removeEventListener(FORCE_OVERLAY_EVENT, handler);
  }, [check]);

  const dismiss30 = () => {
    if (lateMin >= 15) return; // not allowed
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const commit = async () => {
    setCommitting(true);
    setTimeout(() => setCommitting(false), 3000);
    try {
      await startFn({ data: {} });
      setShow(false);
      setForced(false);
    } catch (e) {
      console.error("Sleep session error:", e);
    }
    window.location.href = "/sleep";
  };

  const name = getOnboardingName();
  const heading =
    lateMin >= 30
      ? `You've lost ${lateMin} mins of sleep tonight`
      : lateMin >= 15
        ? `You're ${lateMin} mins past your sleep goal`
        : `It's sleep time${name ? `, ${name}` : ""}`;
  const canDismiss = lateMin < 15 && !forced && lateMin < 45;
  const noDismissAtAll = lateMin >= 45 || forced;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9000] flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.85)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Moon className="h-8 w-8 text-white" />
            </div>
            <h2
              className="font-display tracking-tight text-white"
              style={{ fontSize: "28px", fontWeight: 600, lineHeight: 1.2 }}
            >
              {heading}
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
              Sleep debt this week: {formatHM(stats.debtMin)}
            </p>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
              Current streak: {stats.streak} day{stats.streak === 1 ? "" : "s"} — don't break it
            </p>
            <button
              type="button"
              onClick={commit}
              disabled={committing}
              className="mt-10 w-full rounded-full border-0 shadow-2xl transition active:scale-[0.98]"
              style={{
                background: "#ffffff",
                color: "#0f0a28",
                fontSize: "18px",
                fontWeight: 700,
                lineHeight: 1,
                paddingTop: "20px",
                paddingBottom: "20px",
                minHeight: 56,
                letterSpacing: "0.01em",
              }}
            >
              {committing ? "Starting…" : "Commit to Sleep"}
            </button>
            {canDismiss && !noDismissAtAll && (
              <button
                type="button"
                onClick={dismiss30}
                className="mt-5 underline-offset-4 hover:underline"
                style={{
                  background: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "13px",
                  minHeight: 44,
                  padding: "10px 16px",
                }}
              >
                Dismiss for 30 min
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Moon } from "lucide-react";
import { getActiveSleepSession, getLatestSleepSession } from "../lib/api/sleep.functions";

const DISMISS_KEY = "sleep_overlay_dismissed_at";
const DISMISS_MS = 30 * 60 * 1000;

function parseHHMM(value: string | null | undefined, fallback: [number, number]): [number, number] {
  if (!value) return fallback;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return fallback;
  return [Number(m[1]), Number(m[2])];
}

function getName(): string {
  try {
    const draft = JSON.parse(localStorage.getItem("onboarding_draft") || "{}");
    return draft.name || "";
  } catch {
    return "";
  }
}

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
  const [show, setShow] = useState(false);

  const check = useCallback(async () => {
    if (!enabled) { setShow(false); return; }
    const now = new Date();
    const hour = now.getHours();
    // Don't intrude during the day or after 3am
    if (hour >= 3 && hour < 18) { setShow(false); return; }

    const [sh, sm] = parseHHMM(localStorage.getItem("sleep_goal_time"), [22, 0]);
    const target = new Date(now);
    target.setHours(sh, sm, 0, 0);
    // If goal is e.g. 22:00 and it's already 1am, target was yesterday — still "passed".
    const passed = now.getTime() >= target.getTime() || hour < 3;
    if (!passed) { setShow(false); return; }

    // Respect 30-min dismiss
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || "0");
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS) {
      setShow(false);
      return;
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
  }, [enabled, fetchActive, fetchLatest]);

  useEffect(() => {
    void check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [check]);

  const dismiss30 = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const name = getName();

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[80] flex items-center justify-center px-6"
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
              It's sleep time{name ? `, ${name}` : ""}
            </h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
              Put your phone down and let your brain recover.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/sleep" })}
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
              Sleep Now
            </button>
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
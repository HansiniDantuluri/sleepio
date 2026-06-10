import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import { getActiveSleepSession, getLatestSleepSession } from "../lib/api/sleep.functions";
import { getDailyQuote } from "../data/quotes";

export type NudgeType = "pre" | "at" | "late";

export type NudgeData = {
  type: NudgeType;
  message: string;
  to: string;
  border: string;
  autoDismissMs: number | null; // null = persistent
};

function parseHHMM(value: string | null | undefined, fallback: [number, number]): [number, number] {
  if (!value) return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return fallback;
  return [Number(m[1]), Number(m[2])];
}

function getName(): string {
  try {
    const draft = JSON.parse(localStorage.getItem("onboarding_draft") || "{}");
    return draft.name || "friend";
  } catch {
    return "friend";
  }
}

function todayKey(d: Date = new Date()) {
  // Reset at 6am — a "night" runs 6am-6am
  const shifted = new Date(d.getTime() - 6 * 3600 * 1000);
  return `${shifted.getFullYear()}-${shifted.getMonth() + 1}-${shifted.getDate()}`;
}

function formatTime(h: number, m: number) {
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${period}`;
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
  const checkingRef = useRef(false);

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
        const now = new Date();
        const hour = now.getHours();
        // Stop all nudges past 3am up until 6am (assume they fell asleep)
        if (hour >= 3 && hour < 6) return;

        // Check if a sleep session has been started today
        let sleptToday = false;
        try {
          const [active, latest] = await Promise.all([fetchActive(), fetchLatest()]);
          const dayK = todayKey(now);
          const activeStart = active?.session?.start_time
            ? todayKey(new Date(active.session.start_time))
            : null;
          const latestStart = latest?.session?.start_time
            ? todayKey(new Date(latest.session.start_time))
            : null;
          if (activeStart === dayK || latestStart === dayK) sleptToday = true;
        } catch {
          /* unauth or offline — proceed without */
        }
        if (sleptToday) return;

        const [sh, sm] = parseHHMM(localStorage.getItem("sleep_goal_time"), [22, 0]);
        const target = new Date(now);
        target.setHours(sh, sm, 0, 0);
        const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);

        const name = getName();
        const quote = getDailyQuote(now);
        const dayK = todayKey(now);

        const wasSent = (type: NudgeType) =>
          localStorage.getItem(`nudge_${dayK}_${type}`) === "1";
        const markSent = (type: NudgeType) =>
          localStorage.setItem(`nudge_${dayK}_${type}`, "1");

        let candidate: NudgeData | null = null;

        // TRIGGER 3: 15+ min past sleep goal
        if (diffMin <= -15 && !wasSent("late")) {
          candidate = {
            type: "late",
            message: "Still awake? Tap here to start sleep tracking — every minute counts 💙",
            to: "/sleep",
            border: "oklch(0.6 0.22 25)", // red
            autoDismissMs: null,
          };
        }
        // TRIGGER 2: at sleep goal (within 0..-14 min window)
        else if (diffMin <= 0 && diffMin > -15 && !wasSent("at")) {
          candidate = {
            type: "at",
            message: `${name}, it's ${formatTime(sh, sm)}. Time to sleep — your brain will thank you.`,
            to: "/sleep",
            border: "oklch(0.25 0.08 270)", // navy
            autoDismissMs: 10000,
          };
        }
        // TRIGGER 1: 30 min before (within 16..30 min window)
        else if (diffMin <= 30 && diffMin > 15 && !wasSent("pre")) {
          candidate = {
            type: "pre",
            message: `${name}, wind down time in 30 min 🌙 — ${quote}`,
            to: "/wind-down",
            border: "oklch(0.7 0.18 290)", // soft purple
            autoDismissMs: 8000,
          };
        }

        if (cancelled || !candidate) return;
        markSent(candidate.type);
        setNudge(candidate);
        const titleByType: Record<NudgeType, string> = {
          pre: "SleepIO",
          at: "SleepIO — Sleep Time",
          late: "SleepIO — Still Awake?",
        };
        void sendWebPush(titleByType[candidate.type], candidate.message, candidate.to);
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

  useEffect(() => {
    if (!nudge || nudge.autoDismissMs == null) return;
    const id = window.setTimeout(onDismiss, nudge.autoDismissMs);
    return () => window.clearTimeout(id);
  }, [nudge, onDismiss]);

  return (
    <AnimatePresence>
      {nudge && (
        <motion.div
          key={nudge.type}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed left-3 right-3 top-3 z-[60] mx-auto max-w-md"
        >
          <div
            onClick={() => {
              navigate({ to: nudge.to });
              onDismiss();
            }}
            className="flex cursor-pointer items-center gap-3 rounded-2xl p-3 pl-4 shadow-xl"
            style={{
              background: "rgba(15, 10, 40, 0.95)",
              color: "#ffffff",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderLeft: `4px solid ${nudge.border}`,
            }}
            role="button"
            tabIndex={0}
          >
            <p
              className="flex-1 leading-snug"
              style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff" }}
            >
              {nudge.message}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="shrink-0 rounded-full p-1 hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.8)" }}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
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
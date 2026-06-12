import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Moon } from "lucide-react";
import {
  endSleepSession,
  getActiveSleepSession,
  startSleepSession,
} from "../lib/api/sleep.functions";
import { useTheme } from "../components/theme-provider";

export const Route = createFileRoute("/sleep")({
  head: () => ({
    meta: [
      { title: "Sleep — SleepIO" },
      { name: "description", content: "Track your sleep session." },
    ],
  }),
  component: SleepTrackingPage,
});

function fmtClock(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function SleepTrackingPage() {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const start = useServerFn(startSleepSession);
  const end = useServerFn(endSleepSession);
  const fetchActive = useServerFn(getActiveSleepSession);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    setMode("sleep");
  }, [setMode]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    (async () => {
      let cachedId: string | null = null;
      try { cachedId = localStorage.getItem("active_sleep_session_id"); } catch {}
      try {
        const active = await fetchActive();
        if (active.session && (!cachedId || active.session.id === cachedId)) {
          setSessionId(active.session.id);
          setStartedAt(new Date(active.session.start_time));
          try { localStorage.setItem("active_sleep_session_id", active.session.id); } catch {}
          return;
        }
        if (cachedId) {
          // server didn't return an active session but we have a cached id;
          // trust the cache (insert may have just landed) and proceed
          setSessionId(cachedId);
          setStartedAt(new Date());
          return;
        }
      } catch {
        /* not signed in or offline */
        if (cachedId) {
          setSessionId(cachedId);
          setStartedAt(new Date());
          return;
        }
      }
      try {
        const created = await start({ data: { targetMinutes: 480 } });
        setSessionId(created.id);
        setStartedAt(new Date(created.start_time));
        try { localStorage.setItem("active_sleep_session_id", created.id); } catch {}
      } catch {
        // local fallback
        setStartedAt(new Date());
      }
    })();
  }, [fetchActive, start]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Wake detection is intentionally disabled: only the Good Morning button
  // (handleWake) navigates away from /sleep. The screen stays put through
  // backgrounding, screen-off, and auth token expiry. Silent refresh runs
  // from the root.

  const handleWake = async () => {
    if (!sessionId) {
      navigate({ to: "/sleep/quality" });
      return;
    }
    try {
      await end({ data: { id: sessionId, status: "complete" } });
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem("sleepio.lastSessionId", sessionId);
      localStorage.setItem("last_completed_session_id", sessionId);
      localStorage.removeItem("active_sleep_session_id");
    } catch {}
    navigate({ to: "/sleep/quality" });
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.14_0.06_280)] to-[oklch(0.08_0.04_270)] text-white">
      <Stars />
      <Blobs />
      <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col items-center px-6 pb-12 pt-16">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Sleep mode</p>
        <h1 className="mt-2 font-display text-6xl font-semibold tabular-nums tracking-tight">
          {now ? fmtClock(now) : "--:--"}
        </h1>
        {startedAt && (
          <p className="mt-2 text-sm text-white/70">Sleep started at {fmtClock(startedAt)}</p>
        )}

        <motion.div
          animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mt-16 flex h-44 w-44 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15"
        >
          <Moon className="h-20 w-20 text-white" strokeWidth={1.2} />
        </motion.div>

        <p className="mt-6 max-w-xs text-center text-sm text-white/60">
          Tap Good Morning when you wake up to record your sleep
        </p>

        <p className="mt-10 max-w-xs text-center text-xs leading-relaxed text-white/55">
          Sleep time is estimated. Locking your phone pauses phone use — not the clock.
        </p>

        <div className="mt-auto w-full max-w-sm pt-12">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleWake}
            className="w-full rounded-2xl bg-white/95 px-6 py-5 text-base font-semibold text-[oklch(0.18_0.05_270)]"
          >
            Good morning ☀️
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function Stars() {
  const [stars, setStars] = useState<
    { top: number; left: number; size: number; delay: number }[]
  >([]);
  useEffect(() => {
    setStars(
      Array.from({ length: 40 }).map(() => ({
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 4,
      })),
    );
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 3 + s.delay, repeat: Infinity, delay: s.delay }}
        />
      ))}
    </div>
  );
}

function Blobs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-[oklch(0.45_0.18_290)] opacity-30 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-16 bottom-32 h-80 w-80 rounded-full bg-[oklch(0.4_0.15_240)] opacity-30 blur-3xl"
        animate={{ x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
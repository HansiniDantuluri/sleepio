import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getLatestSleepSession,
  getSleepNarrative,
} from "../lib/api/sleep.functions";
import { useTheme } from "../components/theme-provider";

export const Route = createFileRoute("/sleep_/summary")({
  head: () => ({ meta: [{ title: "Sleep summary — SleepIO" }] }),
  component: SleepSummaryPage,
});

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function SleepSummaryPage() {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const fetchLatest = useServerFn(getLatestSleepSession);
  const fetchNarrative = useServerFn(getSleepNarrative);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [actualMin, setActualMin] = useState(0);
  const [quality, setQuality] = useState<number | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [retryUsed, setRetryUsed] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNarrative = async (id: string) => {
    try {
      const r = await fetchNarrative({ data: { id } });
      if (r.narrative) {
        setNarrative(r.narrative);
        setAiFailed(false);
      } else {
        setAiFailed(true);
      }
    } catch {
      setAiFailed(true);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchLatest();
        if (r.session) {
          setSessionId(r.session.id);
          if (r.session.start_time && r.session.end_time) {
            const mins = Math.round(
              (new Date(r.session.end_time).getTime() - new Date(r.session.start_time).getTime()) / 60000,
            );
            setActualMin(Math.max(0, mins));
          }
          setQuality(r.session.quality_score ?? null);
          if (r.session.narrative) {
            setNarrative(r.session.narrative);
          } else {
            await loadNarrative(r.session.id);
          }
        } else {
          setAiFailed(true);
        }
      } catch {
        setAiFailed(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const target = 480;
  const ratio = Math.min(actualMin / target, 1);
  const R = 80;
  const C = 2 * Math.PI * R;

  const startMyDay = () => {
    setMode("auto");
    try { localStorage.setItem("sleepio.scheduleRebuildAt", String(Date.now())); } catch {}
    navigate({ to: "/" });
  };

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.16_0.05_270)] to-[oklch(0.1_0.04_270)] text-white">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 pb-10 pt-12">
        <h1 className="font-display text-3xl font-semibold">Good morning</h1>
        <p className="mt-1 text-sm text-white/65">Here's how last night looked.</p>

        <div className="mt-10 flex flex-col items-center">
          <div className="relative h-[200px] w-[200px]">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
              <motion.circle
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke="white"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: C * (1 - ratio) }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">Sleep</p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {fmtDuration(actualMin)}
              </p>
            </div>
          </div>

          {quality !== null && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm">
              <span className="text-white/65">Quality</span>
              <span className="font-semibold">{quality.toFixed(1)} / 5</span>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/85">
          {loading ? (
            <span className="text-white/55">Reflecting on your week…</span>
          ) : narrative ? (
            <p>{narrative}</p>
          ) : (
            <div className="space-y-3">
              <p>
                Great job getting some rest. Check your Stats for your weekly trends.
              </p>
              {aiFailed && !retryUsed && sessionId && (
                <button
                  type="button"
                  onClick={async () => {
                    setRetryUsed(true);
                    setAiFailed(false);
                    setLoading(true);
                    await loadNarrative(sessionId);
                    setLoading(false);
                  }}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/85"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-auto pt-10">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={startMyDay}
            className="w-full rounded-2xl bg-white px-6 py-5 text-base font-semibold text-[oklch(0.18_0.05_270)]"
          >
            Start My Day
          </motion.button>
        </div>
      </div>
    </div>
  );
}
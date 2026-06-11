import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getLatestSleepSession,
  getSleepNarrative,
  getSleepSession,
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
  const fetchById = useServerFn(getSleepSession);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [timeInBedMin, setTimeInBedMin] = useState(0);
  const [sleepMin, setSleepMin] = useState(0);
  const [hasOnset, setHasOnset] = useState(false);
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
        let cachedId: string | null = null;
        try { cachedId = localStorage.getItem("last_completed_session_id"); } catch {}
        const r = cachedId
          ? await fetchById({ data: { id: cachedId } })
          : await fetchLatest();
        if (r.session) {
          setSessionId(r.session.id);
          if (r.session.start_time && r.session.end_time) {
            const endMs = new Date(r.session.end_time).getTime();
            const startMs = new Date(r.session.start_time).getTime();
            const bedMins = Math.max(0, Math.round((endMs - startMs) / 60000));
            setTimeInBedMin(bedMins);
            const onset = r.session.sleep_onset_time;
            if (onset) {
              const onsetMs = new Date(onset).getTime();
              setSleepMin(Math.max(0, Math.round((endMs - onsetMs) / 60000)));
              setHasOnset(true);
            } else {
              setSleepMin(bedMins);
              setHasOnset(false);
            }
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
  const ratio = Math.min(sleepMin / target, 1);
  const R = 80;
  const C = 2 * Math.PI * R;

  const startMyDay = async () => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { registerPlugin } = await import('@capacitor/core');
        const SleepMode = registerPlugin<{ deactivate: () => Promise<void> }>('SleepMode');
        await SleepMode.deactivate();
      }
    } catch (e) {
      console.log('SleepMode plugin not available:', e);
    }
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
              <p className="text-xs uppercase tracking-[0.2em] text-white/55">
                {hasOnset ? "Actual sleep" : "Estimated sleep"}
              </p>
              <p className="font-display text-3xl font-semibold tabular-nums">
                {fmtDuration(sleepMin)}
              </p>
            </div>
          </div>

          {hasOnset ? (
            <p className="mt-3 text-sm text-white/55">
              Time in bed: {fmtDuration(timeInBedMin)}
            </p>
          ) : (
            <p className="mt-3 text-sm text-white/55">Estimated sleep time</p>
          )}

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
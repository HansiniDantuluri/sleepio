import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  getLatestSleepSession,
  saveSleepQuality,
} from "../lib/api/sleep.functions";

export const Route = createFileRoute("/sleep_/quality")({
  head: () => ({ meta: [{ title: "How did you sleep? — SleepIO" }] }),
  component: SleepQualityPage,
});

const MOODS = [
  { score: 1, emoji: "😴", label: "Groggy" },
  { score: 2, emoji: "😑", label: "Tired" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "🙂", label: "Rested" },
  { score: 5, emoji: "😄", label: "Energised" },
];

function SleepQualityPage() {
  const navigate = useNavigate();
  const save = useServerFn(saveSleepQuality);
  const fetchLatest = useServerFn(getLatestSleepSession);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [actualMinutes, setActualMinutes] = useState<number>(0);
  const [targetMinutes, setTargetMinutes] = useState<number>(480);
  const [mood, setMood] = useState<number | null>(null);
  const [feltEnough, setFeltEnough] = useState<boolean | null>(null);
  const [startIso, setStartIso] = useState<string | null>(null);
  const [onsetTime, setOnsetTime] = useState<string>(""); // "HH:MM"
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem("sleepio.lastSessionId"); } catch {}
    if (stored) setSessionId(stored);
    fetchLatest()
      .then((r) => {
        if (!r.session) return;
        if (!stored) setSessionId(r.session.id);
        if (r.session.start_time && r.session.end_time) {
          const mins = Math.round(
            (new Date(r.session.end_time).getTime() - new Date(r.session.start_time).getTime()) / 60000,
          );
          setActualMinutes(Math.max(0, mins));
        }
        if (r.session.start_time) {
          setStartIso(r.session.start_time);
          const d = new Date(r.session.start_time);
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          setOnsetTime(`${hh}:${mm}`);
        }
        if (r.session.target_minutes) setTargetMinutes(r.session.target_minutes);
      })
      .catch(() => {});
  }, [fetchLatest]);

  const computeQuality = () => {
    if (mood === null) return null;
    const ratio = Math.min((actualMinutes || 0) / Math.max(1, targetMinutes), 1);
    return Math.round((ratio * 5 * 0.6 + mood * 0.4) * 10) / 10;
  };

  const onsetIso = (): string | null => {
    if (!startIso || !onsetTime) return null;
    const [hh, mm] = onsetTime.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const base = new Date(startIso);
    const candidate = new Date(base);
    candidate.setHours(hh, mm, 0, 0);
    // If user picked a time earlier than start_time on the same calendar day,
    // assume they meant the next day (e.g. went to bed 23:50, fell asleep 00:20).
    if (candidate.getTime() < base.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.toISOString();
  };

  const submit = async (skip = false) => {
    setSubmitting(true);
    if (sessionId && !skip) {
      try {
        await save({
          data: {
            id: sessionId,
            mood_score: mood,
            felt_enough: feltEnough,
            quality_score: computeQuality(),
            sleep_onset_time: onsetIso(),
          },
        });
      } catch {
        /* ignore */
      }
    }
    if (sessionId) {
      try { localStorage.setItem("last_completed_session_id", sessionId); } catch {}
    }
    navigate({ to: "/sleep/summary" });
  };

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.14_0.06_280)] to-[oklch(0.08_0.04_270)] text-white">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-6 pb-10 pt-8">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => submit(true)}
            className="text-sm text-white/70 underline-offset-4 hover:underline"
          >
            Skip
          </button>
        </div>
        <div className="mt-6">
          <h1 className="font-display text-3xl font-semibold">How do you feel right now?</h1>
          <div className="mt-6 grid grid-cols-5 gap-2">
            {MOODS.map((m) => (
              <motion.button
                key={m.score}
                whileTap={{ scale: 0.92 }}
                onClick={() => setMood(m.score)}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-4 text-xs ${
                  mood === m.score
                    ? "border-white bg-white/15"
                    : "border-white/15 bg-white/5"
                }`}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] text-white/80">{m.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold">Did you feel you slept enough?</h2>
          <div className="mt-4 flex gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
              { label: "Not sure", value: null as boolean | null },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setFeltEnough(opt.value)}
                className={`flex-1 rounded-full border px-4 py-3 text-sm font-medium ${
                  feltEnough === opt.value
                    ? "border-white bg-white text-[oklch(0.18_0.05_270)]"
                    : "border-white/20 bg-white/5 text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <h2 className="font-display text-xl font-semibold">
            What time did you actually fall asleep?
          </h2>
          <input
            type="time"
            value={onsetTime}
            onChange={(e) => setOnsetTime(e.target.value)}
            className="mt-4 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-lg font-medium text-white [color-scheme:dark] focus:border-white/60 focus:outline-none"
          />
          <p className="mt-2 text-xs text-white/55">
            Optional — helps track actual sleep vs time in bed
          </p>
        </div>

        <div className="mt-auto flex gap-3 pt-12">
          <Link
            to="/sleep/summary"
            className="flex-1 rounded-2xl border border-white/20 px-4 py-4 text-center text-sm text-white/70"
          >
            Maybe later
          </Link>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit(false)}
            className="flex-[2] rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-[oklch(0.18_0.05_270)] disabled:opacity-60"
          >
            Save & continue
          </button>
        </div>
      </div>
    </div>
  );
}
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

import { useTheme } from "../components/theme-provider";

export const Route = createFileRoute("/wind-down_/breathing")({
  head: () => ({ meta: [{ title: "Breathing — Wind Down" }] }),
  component: BreathingPage,
});

type Phase = "inhale" | "hold" | "exhale";

const PATTERN_PRESETS = {
  "4-7-8": { inhale: 4, hold: 7, exhale: 8 },
  "Box (4-4-4)": { inhale: 4, hold: 4, exhale: 4 },
  "Calm (4-2-6)": { inhale: 4, hold: 2, exhale: 6 },
} as const;

const TARGET_CYCLES = 5;

function BreathingPage() {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const [preset, setPreset] = useState<keyof typeof PATTERN_PRESETS>("4-7-8");
  const pattern = PATTERN_PRESETS[preset];
  const [phase, setPhase] = useState<Phase>("inhale");
  const [secondsLeft, setSecondsLeft] = useState(pattern.inhale);
  const [cycle, setCycle] = useState(1);
  const [running, setRunning] = useState(true);

  useEffect(() => { setMode("sleep"); }, [setMode]);

  useEffect(() => {
    setPhase("inhale");
    setSecondsLeft(pattern.inhale);
    setCycle(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s > 1) return s - 1;
        // advance
        setPhase((p) => {
          if (p === "inhale") {
            setSecondsLeft(pattern.hold);
            return "hold";
          }
          if (p === "hold") {
            setSecondsLeft(pattern.exhale);
            return "exhale";
          }
          setCycle((c) => Math.min(TARGET_CYCLES, c + 1));
          setSecondsLeft(pattern.inhale);
          return "inhale";
        });
        return s;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [running, pattern]);

  const color =
    phase === "inhale"
      ? "oklch(0.7 0.16 240)"
      : phase === "hold"
        ? "oklch(0.6 0.2 290)"
        : "oklch(0.35 0.13 260)";
  const scale = phase === "inhale" ? 1.25 : phase === "hold" ? 1.25 : 0.85;
  const duration =
    phase === "inhale" ? pattern.inhale : phase === "hold" ? 0.4 : pattern.exhale;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.12_0.05_270)] to-[oklch(0.06_0.04_270)] text-white">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/wind-down" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-semibold">Breathing</h1>
        <div className="h-10 w-10" />
      </header>

      <main className="relative mx-auto flex max-w-xl flex-col items-center px-6 pt-6 pb-10">
        <div className="flex gap-2 rounded-full bg-white/10 p-1">
          {(Object.keys(PATTERN_PRESETS) as (keyof typeof PATTERN_PRESETS)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setPreset(k)}
              className={`rounded-full px-3 py-1 text-xs ${preset === k ? "bg-white text-[oklch(0.18_0.05_270)]" : "text-white/75"}`}
            >
              {k}
            </button>
          ))}
        </div>

        <p className="mt-6 text-sm text-white/70">Cycle {cycle} of {TARGET_CYCLES}</p>

        <div className="relative mt-8 flex h-80 w-80 items-center justify-center">
          <motion.div
            animate={{ scale, backgroundColor: color }}
            transition={{ duration, ease: "easeInOut" }}
            className="h-56 w-56 rounded-full opacity-90 shadow-[0_0_60px_10px_rgba(120,80,255,0.35)]"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={phase}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="font-display text-3xl font-semibold capitalize"
              >
                {phase}
              </motion.p>
            </AnimatePresence>
            <p className="mt-2 text-5xl font-semibold tabular-nums">{secondsLeft}</p>
          </div>
        </div>

        <div className="mt-10 flex gap-3">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[oklch(0.18_0.05_270)]"
          >
            {running ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={() => { setCycle(1); setPhase("inhale"); setSecondsLeft(pattern.inhale); }}
            className="rounded-full border border-white/20 px-5 py-2.5 text-sm text-white/85"
          >
            Reset
          </button>
        </div>
      </main>
    </div>
  );
}
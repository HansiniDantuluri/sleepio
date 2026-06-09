import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { useTheme } from "../components/theme-provider";
import { Button } from "../components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  completeFocusSession,
  getFocusStats,
  startFocusSession,
} from "../lib/api/focus.functions";

const searchSchema = z.object({
  task: z.string().max(200).optional(),
  minutes: z.coerce.number().int().min(1).max(240).optional(),
});

export const Route = createFileRoute("/focus")({
  head: () => ({
    meta: [
      { title: "Focus Mode — SleepIO" },
      { name: "description", content: "Deep work focus timer." },
    ],
  }),
  validateSearch: searchSchema,
  component: FocusPage,
});

const LENGTHS = [25, 45, 60] as const;

type Phase = "select" | "running" | "complete";

function plantStage(xp: number) {
  if (xp >= 150) return { emoji: "🌳", label: "Mature tree" };
  if (xp >= 75) return { emoji: "🍀", label: "Lucky clover" };
  if (xp >= 25) return { emoji: "🌿", label: "Sapling" };
  return { emoji: "🌱", label: "Seedling" };
}

function milestone(pct: number): string | null {
  if (pct >= 1) return "Crushed it! 🏆";
  if (pct >= 0.75) return "Almost done ⚡";
  if (pct >= 0.5) return "Halfway there 🔥";
  if (pct >= 0.25) return "Getting started 💪";
  return null;
}

function FocusPage() {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const search = useSearch({ from: "/focus" });
  const taskFromQuery = search.task ?? "Deep work";
  const minutesFromQuery = search.minutes;

  const start = useServerFn(startFocusSession);
  const complete = useServerFn(completeFocusSession);
  const fetchStats = useServerFn(getFocusStats);

  const [phase, setPhase] = useState<Phase>("select");
  const [length, setLength] = useState<number>(minutesFromQuery ?? 25);
  const [remaining, setRemaining] = useState<number>((minutesFromQuery ?? 25) * 60);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [totalXp, setTotalXp] = useState<number>(0);
  const [sessionXp, setSessionXp] = useState<number>(0);
  const [milestoneShown, setMilestoneShown] = useState<string | null>(null);

  useEffect(() => {
    setMode("productivity");
  }, [setMode]);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchStats();
        setTodayCount(s.todayCount);
        setTotalXp(s.totalXp);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick down
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const totalSec = length * 60;
  const progress = phase === "running" ? 1 - remaining / totalSec : 0;
  const currentXp = Math.floor(progress * length);

  // Milestone toasts
  useEffect(() => {
    if (phase !== "running") return;
    const m = milestone(progress);
    if (m && m !== milestoneShown && progress < 1) {
      setMilestoneShown(m);
      toast(m);
    }
  }, [progress, phase, milestoneShown]);

  // Completion
  useEffect(() => {
    if (phase !== "running" || remaining > 0) return;
    setRunning(false);
    (async () => {
      const xp = length;
      setSessionXp(xp);
      try {
        if (sessionId) {
          await complete({
            data: { id: sessionId, actual_minutes: length, xp_earned: xp, status: "complete" },
          });
        }
      } catch {
        /* ignore */
      }
      setTotalXp((p) => p + xp);
      setTodayCount((p) => p + 1);
      setPhase("complete");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, phase]);

  const beginSession = async () => {
    setRemaining(length * 60);
    setMilestoneShown(null);
    setStartedAt(Date.now());
    setPhase("running");
    setRunning(true);
    try {
      const r = await start({ data: { planned_minutes: length, task_name: taskFromQuery } });
      setSessionId(r.id);
    } catch {
      /* still allow timer to run */
    }
  };

  const abandonSession = async () => {
    setRunning(false);
    const elapsed = Math.max(0, Math.round((Date.now() - startedAt) / 60000));
    const xp = Math.floor((elapsed / length) * length);
    try {
      if (sessionId) {
        await complete({
          data: { id: sessionId, actual_minutes: elapsed, xp_earned: xp, status: "abandoned" },
        });
      }
    } catch {
      /* ignore */
    }
    navigate({ to: "/" });
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[oklch(0.98_0.01_240)] via-background to-background text-foreground">
      {/* Header */}
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-6">
        {phase === "running" ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End session early?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your progress so far will be saved.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep going</AlertDialogCancel>
                <AlertDialogAction onClick={abandonSession}>End session</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="text-center">
          <h1 className="font-display text-xl font-semibold">Focus Mode</h1>
        </div>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          Session {todayCount + (phase === "complete" ? 0 : 1)} today
        </span>
      </header>

      {/* Body */}
      <main className="mx-auto flex min-h-[calc(100dvh-80px)] max-w-xl flex-col items-center justify-center px-5 pb-10">
        {phase === "select" && (
          <div className="w-full">
            <p className="text-center text-sm text-muted-foreground">Choose your focus length</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {LENGTHS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setLength(m);
                    setRemaining(m * 60);
                  }}
                  className={`rounded-2xl border-2 px-3 py-6 text-center transition-all ${
                    length === m
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-foreground"
                  }`}
                >
                  <div className="font-display text-2xl font-semibold">{m}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">min</div>
                </button>
              ))}
            </div>
            <Button onClick={beginSession} className="mt-8 w-full py-6 text-base">
              Start Focus Session
            </Button>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Total XP earned: <span className="font-semibold text-foreground">{totalXp}</span>
            </p>
          </div>
        )}

        {phase === "running" && (
          <RunningView
            length={length}
            remaining={remaining}
            running={running}
            progress={progress}
            currentXp={currentXp}
            taskName={taskFromQuery}
            onToggle={() => setRunning((r) => !r)}
          />
        )}

        {phase === "complete" && (
          <CompleteView
            length={length}
            xp={sessionXp}
            taskName={taskFromQuery}
            onNext={() => {
              setPhase("select");
              setSessionId(null);
              setRemaining(length * 60);
            }}
            onBreak={() => navigate({ to: "/wind-down" })}
          />
        )}
      </main>

      {/* App Blocking pill */}
      {phase === "running" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-700 backdrop-blur dark:text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            App Blocking: Active
          </div>
        </div>
      )}
    </div>
  );
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function RunningView({
  length,
  remaining,
  running,
  progress,
  currentXp,
  taskName,
  onToggle,
}: {
  length: number;
  remaining: number;
  running: boolean;
  progress: number;
  currentXp: number;
  taskName: string;
  onToggle: () => void;
}) {
  const R = 120;
  const C = 2 * Math.PI * R;
  const stage = plantStage(currentXp);
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative">
        <svg className="h-[280px] w-[280px] -rotate-90" viewBox="0 0 280 280">
          <defs>
            <linearGradient id="focusGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.65 0.18 250)" />
              <stop offset="100%" stopColor="oklch(0.55 0.22 300)" />
            </linearGradient>
          </defs>
          <circle cx="140" cy="140" r={R} fill="none" stroke="oklch(0.92 0.01 250)" strokeWidth="14" />
          <motion.circle
            cx="140"
            cy="140"
            r={R}
            fill="none"
            stroke="url(#focusGrad)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - progress) }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ filter: "drop-shadow(0 0 18px oklch(0.65 0.18 280 / 0.55))" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-5xl font-semibold tabular-nums">{fmtTime(remaining)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{length} min</p>
        </div>
      </div>

      <p className="mt-6 max-w-xs truncate text-center text-base font-medium">{taskName}</p>

      {/* XP bar */}
      <div className="mt-5 w-full max-w-xs">
        <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Focus XP</span>
          <span className="font-semibold text-foreground">{currentXp} / {length}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
            animate={{ width: `${Math.min(100, progress * 100)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Plant */}
      <motion.div
        key={stage.emoji}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 350, damping: 14 }}
        className="mt-6 text-5xl"
        aria-label={stage.label}
      >
        {stage.emoji}
      </motion.div>

      <motion.button
        type="button"
        onClick={onToggle}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.03 }}
        className="mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-purple-500/30"
        aria-label={running ? "Pause" : "Play"}
      >
        <AnimatePresence mode="wait" initial={false}>
          {running ? (
            <motion.span key="pause" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.18 }}>
              <Pause className="h-7 w-7 fill-current" />
            </motion.span>
          ) : (
            <motion.span key="play" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }} transition={{ duration: 0.18 }}>
              <Play className="h-7 w-7 fill-current" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

function CompleteView({
  length,
  xp,
  taskName,
  onNext,
  onBreak,
}: {
  length: number;
  xp: number;
  taskName: string;
  onNext: () => void;
  onBreak: () => void;
}) {
  const particles = useMemo(
    () =>
      Array.from({ length: 36 }).map((_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 360,
        y: (Math.random() - 1) * 360 - 50,
        rotate: Math.random() * 360,
        color: ["#60a5fa", "#a78bfa", "#f472b6", "#facc15", "#34d399"][i % 5],
        delay: Math.random() * 0.15,
      })),
    [],
  );

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* Confetti burst */}
      <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center">
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotate }}
            transition={{ duration: 1.6, ease: "easeOut", delay: p.delay }}
            className="absolute inline-block h-2 w-2 rounded-sm"
            style={{ background: p.color }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 16 }}
        className="text-6xl"
      >
        🏆
      </motion.div>
      <h2 className="mt-4 font-display text-3xl font-semibold">Session complete</h2>
      <p className="mt-1 truncate text-sm text-muted-foreground">{taskName} · marked complete</p>

      <div className="mt-6 grid w-full max-w-xs grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Time</p>
          <p className="mt-1 font-display text-2xl font-semibold">{length}m</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-3 text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">XP earned</p>
          <p className="mt-1 font-display text-2xl font-semibold">+{xp}</p>
        </div>
      </div>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
        <Button onClick={onNext} className="w-full py-5 text-base">Start Next Task</Button>
        <Button onClick={onBreak} variant="outline" className="w-full py-5 text-base">Take a Break</Button>
      </div>
    </div>
  );
}
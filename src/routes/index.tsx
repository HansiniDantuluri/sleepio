import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, ChevronRight, BookOpen, Coffee, Moon, Sparkles, Clock, X, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/app-shell";
import { getCoachMessage } from "../lib/api/coach.functions";
import { getActiveSchedule, saveActiveSchedule } from "../lib/api/schedule.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SleepIO — Sleep smarter, study sharper" },
      { name: "description", content: "Personalized sleep, study, and schedule companion for IB and IGCSE students." },
      { property: "og:title", content: "SleepIO" },
      { property: "og:description", content: "Personalized sleep, study, and schedule companion for IB and IGCSE students." },
    ],
  }),
  component: Index,
});

function parseHHMM(value: string | null | undefined, fallback: [number, number]): [number, number] {
  if (!value) return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return fallback;
  return [Number(m[1]), Number(m[2])];
}

function minutesUntil(targetH: number, targetM: number, now: Date): number {
  const target = new Date(now);
  target.setHours(targetH, targetM, 0, 0);
  let diff = (target.getTime() - now.getTime()) / 60000;
  if (diff <= 0) diff += 24 * 60;
  return Math.round(diff);
}

function todayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function Index() {
  const [now, setNow] = useState<Date | null>(null);
  const [greeting, setGreeting] = useState<string>("");
  const [coachMsg, setCoachMsg] = useState<string>("");
  const fetchCoach = useServerFn(getCoachMessage);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!now) return;
    const h = now.getHours();
    const part = h < 5 ? "evening" : h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
    let name = "";
    try {
      const draft = JSON.parse(localStorage.getItem("onboarding_draft") || "{}");
      name = draft.name || "";
    } catch {
      /* ignore */
    }
    setGreeting(`Good ${part}${name ? `, ${name}` : ""}`);
  }, [now]);

  useEffect(() => {
    if (!now) return;
    const key = `coach_msg_${todayKey(now)}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      setCoachMsg(cached);
      return;
    }
    let cancelled = false;
    fetchCoach({ data: { hour: now.getHours() } })
      .then((res) => {
        if (cancelled) return;
        setCoachMsg(res.message);
        localStorage.setItem(key, res.message);
      })
      .catch(() => {
        if (!cancelled) setCoachMsg("Keep going — every focused minute counts.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now ? todayKey(now) : null]);

  const sleep = useMemo(() => {
    if (typeof window === "undefined") return { h: 22, m: 0 };
    const [h, m] = parseHHMM(localStorage.getItem("sleep_goal_time"), [22, 0]);
    return { h, m };
  }, [now]);

  if (!now) {
    return (
      <AppShell title="SleepIO">
        <div className="h-40 animate-pulse rounded-3xl bg-muted/60" />
      </AppShell>
    );
  }

  const minsToSleep = minutesUntil(sleep.h, sleep.m, now);
  const hours = Math.floor(minsToSleep / 60);
  const mins = minsToSleep % 60;

  let ringColor = "var(--chart-5)"; // green
  let zone: "calm" | "warn" | "urgent" = "calm";
  if (minsToSleep < 60) {
    ringColor = "var(--destructive)";
    zone = "urgent";
  } else if (minsToSleep <= 120) {
    ringColor = "oklch(0.75 0.18 65)";
    zone = "warn";
  }

  // Ring progress: fuller as sleep approaches. 6h window -> 0%, 0min -> 100%.
  const WINDOW = 6 * 60;
  const progress = Math.max(0, Math.min(1, 1 - minsToSleep / WINDOW));

  return (
    <AppShell subtitle={greeting} title="SleepIO">
      <div className="space-y-6">
        <SleepRing
          progress={progress}
          color={ringColor}
          hours={hours}
          mins={mins}
          zone={zone}
        />

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex gap-3 rounded-3xl border border-border bg-surface p-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-brand">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="text-sm leading-relaxed text-foreground">
            {coachMsg || <span className="text-muted-foreground">Your coach is thinking…</span>}
          </p>
        </motion.div>

        <Timeline now={now} sleepHour={sleep.h} sleepMin={sleep.m} />

        <div className="grid grid-cols-3 gap-3">
          <ActionButton to="/plan" label="Plan My Day" tone="brand" />
          <ActionButton to="/focus" label="Start Focus" tone="accent" />
          <ActionButton to="/wind-down" label="Wind Down" tone="muted" />
        </div>

        <StatsCard />
      </div>
    </AppShell>
  );
}

function SleepRing({
  progress,
  color,
  hours,
  mins,
  zone,
}: {
  progress: number;
  color: string;
  hours: number;
  mins: number;
  zone: "calm" | "warn" | "urgent";
}) {
  const R = 88;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - progress);
  const label =
    zone === "urgent" ? "Sleep window now" : zone === "warn" ? "Wind down soon" : "Sleep protected";

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[220px] w-[220px]">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
          <motion.circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Sleep in
          </p>
          <p className="mt-1 font-display text-4xl font-semibold tracking-tight text-foreground">
            {hours}h {mins}m
          </p>
          <p className="mt-2 text-xs font-medium" style={{ color }}>
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

type Block = {
  id: string;
  kind: "task" | "break" | "wind" | "sleep";
  title: string;
  startMin: number; // minutes from now
  durationMin: number;
  priority?: "high" | "medium" | "low";
};

function Timeline({ now, sleepHour, sleepMin }: { now: Date; sleepHour: number; sleepMin: number }) {
  const totalMin = minutesUntil(sleepHour, sleepMin, now);
  const windStart = Math.max(0, totalMin - 30);

  const blocks: Block[] = useMemo(() => {
    const items: Block[] = [];
    // Two tasks + one break + wind-down + sleep, scaled into the window
    const t1Start = Math.min(15, Math.floor(totalMin * 0.05));
    const t1Dur = Math.max(25, Math.floor(totalMin * 0.2));
    const breakStart = t1Start + t1Dur;
    const breakDur = 15;
    const t2Start = breakStart + breakDur;
    const t2Dur = Math.max(25, Math.floor(totalMin * 0.2));

    items.push({ id: "t1", kind: "task", title: "Math: Past paper questions", startMin: t1Start, durationMin: t1Dur, priority: "high" });
    items.push({ id: "b1", kind: "break", title: "Short break", startMin: breakStart, durationMin: breakDur });
    items.push({ id: "t2", kind: "task", title: "English: Essay outline", startMin: t2Start, durationMin: t2Dur, priority: "medium" });
    items.push({ id: "wd", kind: "wind", title: "Wind down", startMin: windStart, durationMin: 30 });
    items.push({ id: "sl", kind: "sleep", title: "Sleep", startMin: totalMin, durationMin: 30 });
    return items;
  }, [totalMin, windStart]);

  return (
    <div className="rounded-3xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-foreground">Today's timeline</h2>
        <span className="text-xs text-muted-foreground">
          {fmtClock(now)} → {String(sleepHour).padStart(2, "0")}:{String(sleepMin).padStart(2, "0")}
        </span>
      </div>
      <div className="relative max-h-[360px] overflow-y-auto pr-1">
        <div className="relative space-y-2 pl-6">
          {/* spine */}
          <div className="pointer-events-none absolute left-2 top-1 bottom-1 w-px bg-border" />
          {/* current time indicator */}
          <div className="pointer-events-none absolute left-0 right-0 top-0 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            <span className="h-px flex-1 bg-destructive/70" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
              Now
            </span>
          </div>
          <div className="h-3" />
          {blocks.map((b) => (
            <TimelineBlock key={b.id} block={b} now={now} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineBlock({ block, now }: { block: Block; now: Date }) {
  const start = new Date(now.getTime() + block.startMin * 60_000);
  const isSleep = block.kind === "sleep";
  const isWind = block.kind === "wind";
  const isBreak = block.kind === "break";

  let cls = "bg-surface-elevated border border-border";
  let icon = <BookOpen className="h-4 w-4" />;

  if (isSleep) {
    cls = "bg-[oklch(0.25_0.08_270)] text-white border-transparent";
    icon = <Lock className="h-4 w-4" />;
  } else if (isWind) {
    cls = "bg-[oklch(0.88_0.06_295)] dark:bg-[oklch(0.38_0.1_295)] border-transparent";
    icon = <Moon className="h-4 w-4" />;
  } else if (isBreak) {
    cls = "bg-muted border-border";
    icon = <Coffee className="h-4 w-4" />;
  } else if (block.priority === "high") {
    cls = "bg-[oklch(0.95_0.08_25)] dark:bg-[oklch(0.4_0.15_25)] border-transparent";
  } else if (block.priority === "medium") {
    cls = "bg-[oklch(0.96_0.1_90)] dark:bg-[oklch(0.4_0.1_90)] border-transparent";
  } else if (block.priority === "low") {
    cls = "bg-[oklch(0.93_0.07_235)] dark:bg-[oklch(0.38_0.1_235)] border-transparent";
  }

  return (
    <div className="relative">
      <span className="absolute -left-[18px] top-3 h-2 w-2 rounded-full bg-foreground/40" />
      <div
        className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${cls} ${isSleep ? "cursor-not-allowed opacity-95" : ""}`}
        aria-disabled={isSleep}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{block.title}</p>
          <p className="text-[11px] opacity-80">
            {fmtClock(start)} · {block.durationMin}m
          </p>
        </div>
      </div>
    </div>
  );
}

function fmtClock(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ActionButton({ to, label, tone }: { to: string; label: string; tone: "brand" | "accent" | "muted" }) {
  const navigate = useNavigate();
  const toneCls =
    tone === "brand"
      ? "bg-primary text-primary-foreground"
      : tone === "accent"
        ? "bg-accent text-accent-foreground"
        : "bg-surface-elevated text-foreground border border-border";
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 18 }}
      onClick={() => navigate({ to })}
      className={`flex h-20 flex-col items-center justify-center rounded-2xl px-2 text-xs font-semibold leading-tight ${toneCls}`}
    >
      {label}
    </motion.button>
  );
}

function StatsCard() {
  return (
    <Link
      to="/stats"
      className="flex items-center justify-between rounded-3xl border border-border bg-surface p-4 transition hover:border-primary/40"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Your stats</p>
        <p className="mt-1 text-sm font-medium text-foreground">Sleep & focus trends</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

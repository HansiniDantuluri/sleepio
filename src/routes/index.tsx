import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Lock, ChevronRight, BookOpen, Coffee, Moon, Sparkles, Clock, X, AlertTriangle, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "../components/app-shell";
import { getCoachMessage } from "../lib/api/coach.functions";
import { getActiveSchedule, saveActiveSchedule } from "../lib/api/schedule.functions";
import { getActiveStudyPlan } from "../lib/api/academics.functions";
import { listExams, listIAs } from "../lib/api/academics.functions";
import { getFocusStats } from "../lib/api/focus.functions";
import { NotificationBanner, type BannerData } from "../components/notification-banner";
import { SleepNudgeBanner, PushPermissionCard, useSleepNudge, useSleepGoalTime, useSleepStats } from "../components/sleep-nudge";
import { SleepOverlay } from "../components/sleep-overlay";
import { getSettings } from "../lib/api/settings.functions";
import { getActiveSleepSession, getLatestSleepSession, startSleepSession } from "../lib/api/sleep.functions";
import { getDailyQuote } from "../data/quotes";

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
  const fetchActive = useServerFn(getActiveSchedule);
  const saveActive = useServerFn(saveActiveSchedule);

  const [activeBlocks, setActiveBlocks] = useState<ServerBlock[] | null>(null);
  const [activeTasks, setActiveTasks] = useState<ServerTask[]>([]);
  const [activePrefs, setActivePrefs] = useState<ServerPrefs | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [overflowWarning, setOverflowWarning] = useState(false);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [studyBlocks, setStudyBlocks] = useState<{ subject: string; minutes: number; focus: string }[]>([]);
  const fetchStudyPlan = useServerFn(getActiveStudyPlan);
  const navigate = useNavigate();
  const fetchExams = useServerFn(listExams);
  const fetchIAs = useServerFn(listIAs);
  const fetchFocusStats = useServerFn(getFocusStats);
  const [banner, setBanner] = useState<BannerData | null>(null);
  const { nudge, dismiss: dismissNudge, permissionPrompt, allowPermission, denyPermission } = useSleepNudge();
  const fetchSettings = useServerFn(getSettings);
  const [overlayEnabled, setOverlayEnabled] = useState<boolean>(true);
  const sleepGoal = useSleepGoalTime();
  const sleepStats = useSleepStats();
  const fetchActiveSleep = useServerFn(getActiveSleepSession);
  const fetchLatestSleep = useServerFn(getLatestSleepSession);
  const startSleepFn = useServerFn(startSleepSession);
  const [sleptTonight, setSleptTonight] = useState(false);
  const [committingSleep, setCommittingSleep] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const nightK = (d: Date) => {
      const s = new Date(d.getTime() - 6 * 3600 * 1000);
      return `${s.getFullYear()}-${s.getMonth() + 1}-${s.getDate()}`;
    };
    const check = async () => {
      try {
        const [active, latest] = await Promise.all([fetchActiveSleep(), fetchLatestSleep()]);
        if (cancelled) return;
        const todayK = nightK(new Date());
        const aK = active?.session?.start_time ? nightK(new Date(active.session.start_time)) : null;
        const lK = latest?.session?.start_time ? nightK(new Date(latest.session.start_time)) : null;
        setSleptTonight(aK === todayK || lK === todayK);
      } catch {
        if (!cancelled) setSleptTonight(false);
      }
    };
    void check();
    const id = window.setInterval(check, 60_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [fetchActiveSleep, fetchLatestSleep]);

  const commitToSleep = useCallback(async () => {
    setCommittingSleep(true);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setCommittingSleep(false), 3000);
    }
    try {
      await startSleepFn({ data: {} });
      setSleptTonight(true);
    } catch (e) {
      console.error("Sleep session error:", e);
    }
    if (typeof window !== "undefined") {
      window.location.href = "/sleep";
    }
  }, [startSleepFn]);

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((res) => {
        if (cancelled) return;
        // Default: ON. Disabled only when explicitly set to false.
        setOverlayEnabled(res.settings.app_blocking !== false);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchSettings]);

  // Notification banner check (runs once on mount)
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      // Don't show if user is typing in an input
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)
      ) {
        return;
      }
      const nowDate = new Date();
      const dayKey = `${nowDate.getFullYear()}-${nowDate.getMonth() + 1}-${nowDate.getDate()}`;
      const sleepMode = nowDate.getHours() >= 20 || nowDate.getHours() < 6;

      const wasShown = (type: string) =>
        localStorage.getItem(`banner_${dayKey}_${type}`) === "1";
      const markShown = (type: string) =>
        localStorage.setItem(`banner_${dayKey}_${type}`, "1");

      const daysUntil = (iso: string) => {
        const target = new Date(iso);
        target.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.round((target.getTime() - today.getTime()) / 86400000);
      };

      let candidate: BannerData | null = null;

      // 1. EXAM REMINDER (highest priority)
      try {
        const { exams } = await fetchExams();
        const upcoming = (exams ?? [])
          .map((e: { subject: string; exam_date: string }) => ({ ...e, d: daysUntil(e.exam_date) }))
          .filter((e) => e.d >= 0)
          .sort((a, b) => a.d - b.d);
        const e = upcoming[0];
        if (e && !wasShown("exam")) {
          if (e.d <= 7) {
            candidate = {
              type: "exam",
              message: `⚡ ${e.subject} exam in ${e.d} day${e.d === 1 ? "" : "s"} — final revision time`,
              to: "/academics",
            };
          } else if (e.d <= 30) {
            candidate = {
              type: "exam",
              message: `📅 ${e.subject} exam in ${e.d} days — your prep plan is ready`,
              to: "/academics",
            };
          }
        }
      } catch {
        /* ignore */
      }

      // 2. IA DEADLINE
      if (!candidate) {
        try {
          const { ias } = await fetchIAs();
          const upcoming = (ias ?? [])
            .map((i: { subject: string; due_date: string }) => ({ ...i, d: daysUntil(i.due_date) }))
            .filter((i) => i.d >= 0)
            .sort((a, b) => a.d - b.d);
          const i = upcoming[0];
          if (i && !wasShown("ia")) {
            if (i.d <= 1) {
              candidate = {
                type: "ia",
                message: `🚨 ${i.subject} IA due tomorrow — final push!`,
                to: "/academics",
              };
            } else if (i.d <= 3) {
              candidate = {
                type: "ia",
                message: `⚠️ ${i.subject} IA due in ${i.d} days — stay on track`,
                to: "/academics",
              };
            } else if (i.d <= 7) {
              candidate = {
                type: "ia",
                message: `📝 ${i.subject} IA due in ${i.d} days — time to start`,
                to: "/academics",
              };
            }
          }
        } catch {
          /* ignore */
        }
      }

      // 3. SLEEP REMINDER
      if (!candidate && !wasShown("sleep")) {
        const [sh, sm] = parseHHMM(localStorage.getItem("sleep_goal_time"), [22, 0]);
        const mins = minutesUntil(sh, sm, nowDate);
        if (mins <= 30 && mins > 0) {
          candidate = {
            type: "sleep",
            message: `😴 ${mins} min until sleep time — wrap up now`,
            to: "/wind-down",
          };
        } else if (mins <= 60 && mins > 0) {
          candidate = {
            type: "sleep",
            message: `🌙 Sleep goal in ${mins} min — start winding down`,
            to: "/wind-down",
          };
        }
      }

      // 4. FOCUS NUDGE
      if (!candidate && !wasShown("focus")) {
        const h = nowDate.getHours();
        if (h >= 16 && h < 20) {
          try {
            const stats = await fetchFocusStats();
            if ((stats?.todayCount ?? 0) === 0) {
              candidate = {
                type: "focus",
                message: "🎯 No focus session yet today — even 25 min helps",
                to: "/focus",
              };
            }
          } catch {
            /* ignore */
          }
        }
      }

      if (cancelled || !candidate) return;
      markShown(candidate.type);
      candidate.sleepMode = sleepMode;
      setBanner(candidate);
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Load active schedule once
  useEffect(() => {
    let cancelled = false;
    fetchActive()
      .then((res) => {
        if (cancelled || !res.schedule) return;
        setActiveBlocks((res.schedule.blocks as ServerBlock[]) ?? null);
        setActiveTasks((res.schedule.tasks as ServerTask[]) ?? []);
        setActivePrefs((res.schedule.preferences as ServerPrefs) ?? null);
      })
      .catch(() => {
        /* unauth or offline: fallback to mock */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchActive]);

  // Load today's study blocks from active plan
  useEffect(() => {
    let cancelled = false;
    fetchStudyPlan()
      .then((r) => {
        if (cancelled || !r.plan) return;
        const todayIso = new Date().toISOString().slice(0, 10);
        const blocks: { subject: string; minutes: number; focus: string }[] = [];
        for (const w of r.plan.weeks ?? []) {
          for (const d of w.days ?? []) {
            if (d.date === todayIso) blocks.push(...(d.blocks ?? []));
          }
        }
        setStudyBlocks(blocks);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [fetchStudyPlan]);

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

  const sleepStartMin = sleep.h * 60 + sleep.m;

  const applyRebuild = useCallback(
    async (nextBlocks: ServerBlock[], changed: string[]) => {
      // Always preserve original sleep block time
      const originalSleep = activeBlocks?.find((b) => b.type === "sleep");
      const withSleep = nextBlocks.map((b) =>
        b.type === "sleep" && originalSleep ? { ...originalSleep } : b,
      );
      // Detect tasks pushed past sleep
      const overflow = withSleep.some(
        (b) => b.type !== "sleep" && b.type !== "wind" && toMin(b.endTime) > sleepStartMin,
      );
      setOverflowWarning(overflow);

      setRebuilding(true);
      setActiveBlocks(withSleep);
      setScheduleVersion((v) => v + 1);
      setChangedKeys(new Set(changed));

      // Pulse for 2s
      window.setTimeout(() => setChangedKeys(new Set()), 2000);

      try {
        if (activePrefs) {
          await saveActive({ data: { tasks: activeTasks, blocks: withSleep, preferences: activePrefs } });
        }
        toast.success("Schedule updated to keep your sleep on track ✓");
      } catch {
        toast.error("Couldn't save schedule update");
      } finally {
        setRebuilding(false);
      }
    },
    [activeBlocks, activeTasks, activePrefs, saveActive, sleepStartMin],
  );

  const handleDelay = useCallback(
    (index: number) => {
      if (!activeBlocks) return;
      const SHIFT = 15;
      const next: ServerBlock[] = activeBlocks.map((b, i) => {
        if (b.isLocked || b.type === "sleep" || b.type === "wind") return b;
        if (i < index) return b;
        return {
          ...b,
          startTime: fmtMin(toMin(b.startTime) + SHIFT),
          endTime: fmtMin(toMin(b.endTime) + SHIFT),
        };
      });
      const changed = next.slice(index).filter((b) => !b.isLocked && b.type !== "sleep").map(keyOf);
      void applyRebuild(next, changed);
    },
    [activeBlocks, applyRebuild],
  );

  const handleSkip = useCallback(
    (index: number) => {
      if (!activeBlocks) return;
      const removed = activeBlocks[index];
      if (!removed || removed.isLocked || removed.type === "sleep") return;
      const dur = toMin(removed.endTime) - toMin(removed.startTime);
      const next: ServerBlock[] = [];
      activeBlocks.forEach((b, i) => {
        if (i === index) return;
        if (i > index && !b.isLocked && b.type !== "sleep" && b.type !== "wind") {
          next.push({
            ...b,
            startTime: fmtMin(Math.max(0, toMin(b.startTime) - dur)),
            endTime: fmtMin(Math.max(0, toMin(b.endTime) - dur)),
          });
        } else {
          next.push(b);
        }
      });
      const changed = next.filter((b) => !b.isLocked && b.type !== "sleep" && b.type !== "wind").map(keyOf);
      void applyRebuild(next, changed);
    },
    [activeBlocks, applyRebuild],
  );

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
      <Link
        to="/settings"
        aria-label="Settings"
        className="fixed right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 backdrop-blur transition-opacity hover:opacity-80"
        style={{ width: 36, height: 36 }}
      >
        <Settings
          className="h-[18px] w-[18px]"
          style={{ color: (now.getHours() >= 20 || now.getHours() < 6) ? "rgba(255,255,255,0.9)" : "#6b7280" }}
        />
      </Link>
      <NotificationBanner banner={banner} onDismiss={() => setBanner(null)} />
      <SleepNudgeBanner nudge={nudge} onDismiss={dismissNudge} />
      <SleepOverlay enabled={overlayEnabled} />
      <PersistentSleepBanner
        goal={sleepGoal}
        streak={sleepStats.streak}
        sleptTonight={sleptTonight}
        onCommit={commitToSleep}
        committing={committingSleep}
        now={now}
      />
      <div className="space-y-6">
        {now.getHours() >= 18 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-xs italic text-muted-foreground"
          >
            Hey {(() => {
              try {
                return JSON.parse(localStorage.getItem("onboarding_draft") || "{}").name || "friend";
              } catch {
                return "friend";
              }
            })()} — {getDailyQuote(now)}
          </motion.p>
        )}
        {permissionPrompt && (
          <PushPermissionCard onAllow={allowPermission} onDeny={denyPermission} />
        )}
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

        {activeBlocks === null || activeBlocks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No schedule yet — tap <span className="font-semibold text-foreground">Plan My Day</span> to build your day.
            </p>
          </div>
        ) : (
          <Timeline now={now} sleepHour={sleep.h} sleepMin={sleep.m} />
        )}

        <ScheduleSection
          now={now}
          sleepHour={sleep.h}
          sleepMin={sleep.m}
          activeBlocks={activeBlocks}
          rebuilding={rebuilding}
          changedKeys={changedKeys}
          overflow={overflowWarning}
          version={scheduleVersion}
          onDelay={handleDelay}
          onSkip={handleSkip}
        />

        <div className="grid grid-cols-3 gap-3">
          <ActionButton to="/plan" label="Plan My Day" tone="brand" />
          <ActionButton to="/focus" label="Start Focus" tone="accent" />
          <ActionButton to="/wind-down" label="Wind Down" tone="muted" />
        </div>

        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate({ to: "/sleep" })}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[oklch(0.25_0.08_270)] px-6 py-4 text-sm font-semibold text-white"
        >
          <Moon className="h-4 w-4" /> Sleep Now
        </motion.button>

        {studyBlocks.length > 0 && (
          <div className="rounded-3xl border border-border bg-surface p-4">
            <h2 className="mb-2 font-display text-lg font-semibold text-foreground">Today's study blocks</h2>
            <div className="space-y-2">
              {studyBlocks.map((b, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2">
                  <span className="text-lg">📚</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{b.subject}</p>
                    <p className="text-[11px] text-muted-foreground">{b.minutes}m · {b.focus}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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

// ============= Active schedule (Phase 5) =============

type ServerBlock = {
  startTime: string;
  endTime: string;
  taskName: string;
  type: string;
  color: "red" | "yellow" | "blue" | "purple" | "indigo" | "gray";
  isLocked: boolean;
  rationale: string;
};

type ServerTask = {
  id: string;
  name: string;
  type: string;
  deadline?: string;
  durationMin: number;
  priority: "high" | "medium" | "low";
};

type ServerPrefs = {
  sleepGoalTime: string;
  wakeTime: string;
  energy: "low" | "medium" | "high";
  intensity: number;
  date: string;
};

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function fmtMin(total: number): string {
  const t = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function keyOf(b: ServerBlock): string {
  return `${b.startTime}-${b.taskName}`;
}

function ScheduleSection({
  now,
  sleepHour,
  sleepMin,
  activeBlocks,
  rebuilding,
  changedKeys,
  overflow,
  version,
  onDelay,
  onSkip,
}: {
  now: Date;
  sleepHour: number;
  sleepMin: number;
  activeBlocks: ServerBlock[] | null;
  rebuilding: boolean;
  changedKeys: Set<string>;
  overflow: boolean;
  version: number;
  onDelay: (i: number) => void;
  onSkip: (i: number) => void;
}) {
  if (!activeBlocks || activeBlocks.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {rebuilding && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            Rebuilding your schedule…
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {overflow && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertTriangle className="h-4 w-4" />
            Some tasks moved to tomorrow to protect your sleep
          </motion.div>
        )}
      </AnimatePresence>

      <div className="rounded-3xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Your active schedule</h2>
          <span className="text-xs text-muted-foreground">
            {fmtClock(now)} → {String(sleepHour).padStart(2, "0")}:{String(sleepMin).padStart(2, "0")}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={version}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-2"
          >
            {activeBlocks.map((b, i) => (
              <ActiveBlockRow
                key={`${version}-${keyOf(b)}-${i}`}
                block={b}
                index={i}
                pulse={changedKeys.has(keyOf(b))}
                onDelay={onDelay}
                onSkip={onSkip}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ActiveBlockRow({
  block,
  index,
  pulse,
  onDelay,
  onSkip,
}: {
  block: ServerBlock;
  index: number;
  pulse: boolean;
  onDelay: (i: number) => void;
  onSkip: (i: number) => void;
}) {
  const isSleep = block.type === "sleep";
  const isWind = block.type === "wind";
  const isBreak = block.type === "break";
  const locked = block.isLocked || isSleep;

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
  } else if (block.color === "red") {
    cls = "bg-[oklch(0.95_0.08_25)] dark:bg-[oklch(0.4_0.15_25)] border-transparent";
  } else if (block.color === "yellow") {
    cls = "bg-[oklch(0.96_0.1_90)] dark:bg-[oklch(0.4_0.1_90)] border-transparent";
  } else if (block.color === "blue") {
    cls = "bg-[oklch(0.93_0.07_235)] dark:bg-[oklch(0.38_0.1_235)] border-transparent";
  }

  return (
    <motion.div
      layout
      initial={pulse ? { boxShadow: "0 0 0 0 oklch(0.85 0.18 90)" } : false}
      animate={
        pulse
          ? {
              boxShadow: [
                "0 0 0 0 oklch(0.85 0.18 90 / 0.7)",
                "0 0 0 8px oklch(0.85 0.18 90 / 0)",
                "0 0 0 0 oklch(0.85 0.18 90 / 0.7)",
              ],
            }
          : { boxShadow: "0 0 0 0 oklch(0.85 0.18 90 / 0)" }
      }
      transition={pulse ? { duration: 1, repeat: 2 } : { duration: 0.2 }}
      className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${cls} ${locked ? "opacity-95" : ""}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{block.taskName}</p>
        <p className="text-[11px] opacity-80">
          {block.startTime} – {block.endTime}
        </p>
      </div>
      {!locked && !isWind && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onDelay(index)}
            aria-label="Delay 15 minutes"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition active:scale-90"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSkip(index)}
            aria-label="Skip task"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 transition active:scale-90"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

function PersistentSleepBanner({
  goal,
  streak,
  sleptTonight,
  onCommit,
  committing,
  now,
}: {
  goal: { h: number; m: number; ready: boolean };
  streak: number;
  sleptTonight: boolean;
  onCommit: () => void;
  committing: boolean;
  now: Date;
}) {
  if (!goal.ready || sleptTonight) return null;
  const target = new Date(now);
  target.setHours(goal.h, goal.m, 0, 0);
  const diffMin = Math.round((now.getTime() - target.getTime()) / 60000);
  // diffMin negative = before goal; positive = past goal.
  // Persistent banner shows from sleep_goal_time onward only.
  if (diffMin < 0) return null;

  let message = "It's sleep time — Commit to Sleep";
  let bg = "#0f0a28";
  let pulse = false;
  if (diffMin >= 30) {
    message = `30 min late — Commit to Sleep NOW`;
    bg = "#DC2626";
    pulse = true;
  } else if (diffMin >= 15) {
    message = `15 min past sleep goal — ${streak} day streak at risk`;
    bg = "#DC2626";
  }

  const BANNER_HEIGHT = 56;

  return (
    <>
      <div
        role="status"
        className={pulse ? "sleep-banner-pulse" : undefined}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9998,
          minHeight: BANNER_HEIGHT,
          background: bg,
          color: "#fff",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          padding: "10px 14px",
          transform: "translateZ(0)",
          WebkitTransform: "translateZ(0)",
          willChange: "transform",
        }}
      >
        <div
          className="mx-auto flex max-w-md items-center gap-3"
          style={{ minHeight: 36 }}
        >
          <Link
            to="/settings"
            className="shrink-0 inline-flex items-center gap-1"
            style={{ color: "#fff", opacity: 0.7, textDecoration: "none" }}
          >
            <Settings size={16} />
            <span style={{ fontSize: 11 }}>Settings</span>
          </Link>
          <p
            className="flex-1 leading-snug"
            style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}
          >
            {message}
          </p>
          <button
            type="button"
            onClick={onCommit}
            disabled={committing}
            className="shrink-0 rounded-full transition active:scale-[0.98]"
            style={{
              background: "#fff",
              color: "#0f0a28",
              fontSize: 14,
              fontWeight: 700,
              padding: "9px 16px",
              minHeight: 40,
            }}
          >
            {committing ? "Starting…" : "Commit to Sleep"}
          </button>
        </div>
        <style>{`
          @keyframes sleepBannerPulse {
            0%, 100% { background-color: #DC2626; }
            50% { background-color: #B91C1C; }
          }
          .sleep-banner-pulse {
            animation: sleepBannerPulse 1.6s ease-in-out infinite;
          }
        `}</style>
      </div>
      {/* Spacer so dashboard content does not hide behind the fixed banner */}
      <div aria-hidden style={{ height: BANNER_HEIGHT }} />
    </>
  );
}

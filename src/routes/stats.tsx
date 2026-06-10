import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Lock, RefreshCw, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "../components/app-shell";
import { getStatsData, generateStatsInsight, type StatsSession } from "../lib/api/stats.functions";

export const Route = createFileRoute("/stats")({
  head: () => ({
    meta: [
      { title: "Your Stats — SleepIO" },
      { name: "description", content: "Weekly sleep, study, and focus analytics." },
    ],
  }),
  component: StatsPage,
});

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MOOD_EMOJI = ["😴", "😑", "😐", "🙂", "😄"];

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function durationMin(s: StatsSession): number {
  if (!s.end_time) return 0;
  return Math.max(0, Math.round((new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 60000));
}

function StatsPage() {
  const fetchStats = useServerFn(getStatsData);
  const fetchInsight = useServerFn(generateStatsInsight);

  const [sessions, setSessions] = useState<StatsSession[]>([]);
  const [focusCount, setFocusCount] = useState(0);
  const [iaCount, setIaCount] = useState(0);
  const [hasStudyPlan, setHasStudyPlan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [windDownUses, setWindDownUses] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchStats()
      .then((res) => {
        if (cancelled) return;
        setSessions(res.sessions);
        setFocusCount(res.focusCompletedCount);
        setIaCount(res.iaSubmittedCount);
        setHasStudyPlan(res.hasStudyPlan);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    try {
      setWindDownUses(Number(localStorage.getItem("wind_down_uses") || "0"));
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true;
    };
  }, [fetchStats]);

  // Target derived from latest known target or localStorage
  const targetMinutes = useMemo(() => {
    const latest = sessions.find((s) => s.target_minutes);
    if (latest?.target_minutes) return latest.target_minutes;
    if (typeof window !== "undefined") {
      const t = Number(localStorage.getItem("sleep_target_minutes"));
      if (t > 0) return t;
    }
    return 480;
  }, [sessions]);

  // Streak: consecutive days (ending today or yesterday) meeting target
  const streak = useMemo(() => {
    if (sessions.length === 0) return 0;
    const byDay = new Map<string, number>();
    for (const s of sessions) {
      const d = new Date(s.end_time || s.start_time);
      const k = dayKey(d);
      byDay.set(k, Math.max(byDay.get(k) ?? 0, durationMin(s)));
    }
    let count = 0;
    const cursor = new Date();
    // allow today or yesterday as anchor
    if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 60; i++) {
      const k = dayKey(cursor);
      const mins = byDay.get(k) ?? 0;
      if (mins >= targetMinutes) count++;
      else break;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [sessions, targetMinutes]);

  // This week chart data Mon-Sun
  const weekData = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow);
    monday.setHours(0, 0, 0, 0);
    const days: { label: string; date: string; actual: number; target: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const k = dayKey(d);
      const ses = sessions.find((s) => dayKey(new Date(s.end_time || s.start_time)) === k);
      const actualMin = ses ? durationMin(ses) : 0;
      days.push({
        label: DAY_LABELS[i],
        date: k,
        actual: +(actualMin / 60).toFixed(2),
        target: +(targetMinutes / 60).toFixed(2),
      });
    }
    return days;
  }, [sessions, targetMinutes]);

  // Quality + mood (this week)
  const weekSessions = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => new Date(s.start_time).getTime() >= cutoff);
  }, [sessions]);
  const qualityAvg = useMemo(() => {
    const qs = weekSessions.map((s) => s.quality_score).filter((v): v is number => typeof v === "number");
    if (qs.length === 0) return null;
    return qs.reduce((a, b) => a + b, 0) / qs.length;
  }, [weekSessions]);
  const moodTrend = useMemo(() => {
    return weekSessions
      .slice()
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(-7)
      .map((s) => (s.mood_score ? MOOD_EMOJI[Math.max(0, Math.min(4, s.mood_score - 1))] : "·"));
  }, [weekSessions]);

  const runInsight = async () => {
    setInsightLoading(true);
    try {
      const payload = sessions.slice(0, 14).map((s) => ({
        date: dayKey(new Date(s.start_time)),
        actualMin: durationMin(s),
        targetMin: s.target_minutes ?? targetMinutes,
        quality: s.quality_score ?? null,
        mood: s.mood_score ?? null,
      }));
      const res = await fetchInsight({ data: { payload } });
      setInsight(res.insight);
    } catch {
      setInsight(null);
    } finally {
      setInsightLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && sessions.length > 0 && insight === null && !insightLoading) {
      void runInsight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Achievements
  const earlyBirdStreak = useMemo(() => {
    // 3 days in a row where bedtime (start_time hour:min) <= sleep_goal_time
    const goal = typeof window !== "undefined" ? localStorage.getItem("sleep_goal_time") || "22:00" : "22:00";
    const [gh, gm] = goal.split(":").map(Number);
    const goalMin = gh * 60 + gm;
    const byDay = new Map<string, number>();
    for (const s of sessions) {
      const d = new Date(s.start_time);
      const k = dayKey(d);
      const min = d.getHours() * 60 + d.getMinutes();
      // Allow late evening or early morning; treat after-midnight as +24h late
      const adj = min < 12 * 60 ? min + 24 * 60 : min;
      const adjGoal = goalMin < 12 * 60 ? goalMin + 24 * 60 : goalMin;
      const onTime = adj <= adjGoal ? 1 : 0;
      byDay.set(k, Math.max(byDay.get(k) ?? 0, onTime));
    }
    let max = 0,
      cur = 0;
    const keys = Array.from(byDay.keys()).sort();
    for (const k of keys) {
      if (byDay.get(k)) {
        cur++;
        max = Math.max(max, cur);
      } else cur = 0;
    }
    return max;
  }, [sessions]);

  const achievements = useMemo(() => {
    const first = sessions[sessions.length - 1];
    const firstNightDate = first ? new Date(first.start_time) : null;
    return [
      {
        emoji: "🌙",
        title: "First Night",
        desc: "Completed first sleep session",
        earned: sessions.length > 0,
        date: firstNightDate,
      },
      {
        emoji: "🔥",
        title: "7 Day Streak",
        desc: "Met sleep goal 7 days in a row",
        earned: streak >= 7,
        date: null,
      },
      {
        emoji: "⏰",
        title: "Early Bird",
        desc: "Slept before goal time 3 days in a row",
        earned: earlyBirdStreak >= 3,
        date: null,
      },
      {
        emoji: "🎯",
        title: "Deep Focus",
        desc: "Completed 5 focus sessions",
        earned: focusCount >= 5,
        date: null,
      },
      {
        emoji: "📝",
        title: "IA Champion",
        desc: "Submitted first IA on time",
        earned: iaCount >= 1,
        date: null,
      },
      {
        emoji: "📚",
        title: "Study Machine",
        desc: "Generated first study plan",
        earned: hasStudyPlan,
        date: null,
      },
      {
        emoji: "🌬️",
        title: "Wind Down",
        desc: "Used wind down mode 3 times",
        earned: windDownUses >= 3,
        date: null,
      },
      {
        emoji: "⭐",
        title: "Perfect Week",
        desc: "Met all goals for 7 days straight",
        earned: streak >= 7 && focusCount >= 5 && iaCount >= 1,
        date: null,
      },
    ];
  }, [sessions, streak, earlyBirdStreak, focusCount, iaCount, hasStudyPlan, windDownUses]);

  return (
    <AppShell subtitle="Last 7 days" title="Your Stats">
      <div className="space-y-6">
        {!loading && sessions.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border bg-surface/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">No sleep tracked yet — start tonight.</p>
            <a
              href="/sleep"
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Go to Sleep
            </a>
          </div>
        )}
        {/* Streak */}
        <div className="rounded-3xl border border-border bg-surface p-5 text-center">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex"
          >
            <Flame className="h-10 w-10 text-orange-500" fill="currentColor" />
          </motion.div>
          <p className="mt-2 font-display text-3xl font-bold text-foreground">
            {streak} Day Streak
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {streak === 0
              ? "Start your streak tonight 🌙"
              : `Meeting your sleep goal ${streak} day${streak === 1 ? "" : "s"} in a row`}
          </p>
        </div>

        {/* Quality + mood */}
        <div className="rounded-3xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Sleep Quality Avg
              </p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {qualityAvg !== null ? `${qualityAvg.toFixed(1)} / 5.0` : "— / 5.0"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Mood trend
              </p>
              <p className="mt-1 text-2xl">
                {moodTrend.length > 0 ? moodTrend.join(" ") : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="mb-3 font-display text-lg font-semibold">This week</p>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 10]}
                  ticks={[0, 2, 4, 6, 8, 10]}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fill: "var(--muted-foreground)", fontSize: 11 } }}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number, name: string) => [`${value}h`, name === "actual" ? "Actual" : "Target"]}
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload as { date: string; actual: number; target: number } | undefined;
                    if (!d) return "";
                    const diff = (d.actual - d.target).toFixed(1);
                    const sign = Number(diff) >= 0 ? "+" : "";
                    return `${d.date} · ${sign}${diff}h vs target`;
                  }}
                />
                <Bar dataKey="target" fill="transparent" stroke="var(--border)" strokeWidth={2} radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Log table */}
        <div className="rounded-3xl border border-border bg-surface p-4">
          <p className="mb-3 font-display text-lg font-semibold">Sleep log</p>
          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Date</th>
                  <th className="py-2 text-left">Duration</th>
                  <th className="py-2 text-left">Quality</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No sessions yet.</td></tr>
                )}
                {sessions.map((s) => {
                  const min = durationMin(s);
                  const h = Math.floor(min / 60);
                  const m = min % 60;
                  const ok = s.status === "complete";
                  return (
                    <tr key={s.id} className="border-t border-border">
                      <td className="py-2">{dayKey(new Date(s.start_time))}</td>
                      <td className="py-2">{h}h {m}m</td>
                      <td className="py-2">{s.quality_score ? `${s.quality_score.toFixed(1)}/5` : "—"}</td>
                      <td className="py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ok ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-orange-500/15 text-orange-600 dark:text-orange-400"}`}>
                          {ok ? "complete" : "interrupted"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Insight */}
        <div className="rounded-3xl border border-border bg-surface p-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <p className="font-display text-lg font-semibold">AI insight</p>
            </div>
            <button
              onClick={runInsight}
              disabled={insightLoading || sessions.length === 0}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-muted/70 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${insightLoading ? "animate-spin" : ""}`} /> Regenerate
            </button>
          </div>
          {insightLoading ? (
            <div className="space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
              <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
            </div>
          ) : insight ? (
            <p className="text-sm leading-relaxed text-foreground">{insight}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Keep tracking your sleep to unlock personalized insights.
            </p>
          )}
        </div>

        {/* Achievements */}
        <div>
          <p className="mb-3 font-display text-lg font-semibold">Achievements</p>
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
            {achievements.map((a) => (
              <div
                key={a.title}
                className={`min-w-[140px] shrink-0 rounded-2xl border p-4 ${a.earned ? "border-border bg-surface" : "border-border bg-muted/40 grayscale"}`}
              >
                <div className="mb-2 flex items-center justify-between text-2xl">
                  <span>{a.emoji}</span>
                  {!a.earned && <Lock className="h-4 w-4 text-muted-foreground" />}
                </div>
                <p className="text-sm font-semibold text-foreground">{a.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{a.desc}</p>
                {a.earned && a.date && (
                  <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Earned {dayKey(a.date)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { listExams } from "../lib/api/academics.functions";
import { generateExamPrep } from "../lib/api/exam-prep.functions";
import { SleepFactCard } from "./sleep-fact-card";
import { randomFact } from "../data/sleep-facts";

type Exam = {
  id: string;
  subject: string;
  exam_date: string;
  exam_board: string;
  paper_type: string;
  duration_min?: number | null;
};

function daysUntil(date: string) {
  const d = new Date(date + "T00:00:00").getTime();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((d - now.getTime()) / 86400000);
}

const SUBJECT_COLORS = ["#60a5fa", "#a78bfa", "#f472b6", "#34d399", "#fb923c", "#facc15", "#22d3ee"];
function colorFor(subject: string) {
  let h = 0;
  for (let i = 0; i < subject.length; i++) h = (h * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
}

export function ExamModeTab() {
  const list = useServerFn(listExams);
  const genPrep = useServerFn(generateExamPrep);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selected, setSelected] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(false);
  const [prep, setPrep] = useState<unknown | null>(null);
  const fact = useMemo(() => randomFact("exam"), []);

  useEffect(() => {
    (async () => {
      try { const r = await list(); setExams((r.exams as Exam[]) ?? []); } catch { /* ignore */ }
    })();
  }, []);

  const upcoming = useMemo(
    () => [...exams].filter((e) => daysUntil(e.exam_date) >= 0).sort((a, b) => a.exam_date.localeCompare(b.exam_date)),
    [exams],
  );

  const startPrep = async (exam: Exam) => {
    setSelected(exam);
    setPrep(null);
    setLoading(true);
    try {
      const r = await genPrep({
        data: {
          subject: exam.subject,
          days: Math.max(1, Math.min(60, daysUntil(exam.exam_date) || 1)),
        },
      });
      setPrep(r.plan);
      toast.success("Exam prep plan ready");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (selected && prep) return <PrepView exam={selected} plan={prep} onBack={() => { setSelected(null); setPrep(null); }} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <SleepFactCard fact={fact} />

      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exam Timetable</h3>
        {upcoming.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No upcoming exams. Add one in the Summative Exams tab.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {upcoming.map((exam) => {
              const days = daysUntil(exam.exam_date);
              const color = colorFor(exam.subject);
              return (
                <motion.button
                  type="button"
                  key={exam.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => startPrep(exam)}
                  disabled={loading}
                  className="block w-full rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-left backdrop-blur-md transition-shadow hover:shadow-lg"
                  style={{ WebkitBackdropFilter: "blur(12px)", borderLeft: `4px solid ${color}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{exam.exam_board} · {exam.paper_type}</p>
                      <p className="mt-0.5 truncate text-base font-semibold">{exam.subject}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {exam.exam_date}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: `${color}22`, color }}
                    >
                      {days === 0 ? "Today" : days === 1 ? "1 day" : `${days} days`}
                    </span>
                  </div>
                  {days <= 30 && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Sparkles className="h-3 w-3" /> Tap to prepare
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Generating your prep plan…</span>
        </div>
      )}
    </motion.div>
  );
}

type PrepBlock = { subject: string; topic: string; duration_min: number; technique: string };
type PrepBreakItem = { time: string; activity: string };
type PrepDay = { date: string; study_blocks: PrepBlock[]; breaks: PrepBreakItem[]; sleep_time: string };
type Plan = { days: PrepDay[] };

function PrepView({ exam, plan, onBack }: { exam: Exam; plan: unknown; onBack: () => void }) {
  const p = plan as Plan;
  const fact = useMemo(() => randomFact("exam"), []);
  const [blockSocial, setBlockSocial] = useState(true);
  const days = daysUntil(exam.exam_date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      <Button variant="outline" size="sm" onClick={onBack}>← Back to timetable</Button>

      <div
        className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md"
        style={{ WebkitBackdropFilter: "blur(12px)" }}
      >
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Exam Prep</p>
        <h2
          className="mt-1 font-display text-2xl font-semibold"
          style={{ background: "linear-gradient(135deg, #ffffff, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          {exam.subject}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {exam.exam_board} · {exam.paper_type} · {days === 0 ? "Today" : `${days} days away`}
        </p>
      </div>

      <SleepFactCard fact={fact} />

      <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
        <div>
          <p className="text-sm font-medium">Social media blocking</p>
          <p className="text-xs text-muted-foreground">Recommended during exam prep</p>
        </div>
        <input
          type="checkbox"
          checked={blockSocial}
          onChange={(e) => setBlockSocial(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
      </label>

      <div className="space-y-3">
        {p.days.slice(0, 14).map((d) => (
          <div
            key={d.date}
            className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md"
            style={{ WebkitBackdropFilter: "blur(12px)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{d.date}</p>
            <div className="mt-2 space-y-2">
              {d.study_blocks.map((b, i) => (
                <div key={i} className="rounded-lg bg-primary/10 p-2 text-xs">
                  <p className="font-semibold">📚 {b.topic} — {b.duration_min} min</p>
                  <p className="text-muted-foreground">{b.technique}</p>
                </div>
              ))}
              {d.breaks.map((b, i) => (
                <div key={`br${i}`} className="text-[11px] text-muted-foreground">⏸ {b.time} — {b.activity}</div>
              ))}
              <p className="text-[11px] text-amber-500/90">🌙 Sleep at {d.sleep_time} (locked)</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
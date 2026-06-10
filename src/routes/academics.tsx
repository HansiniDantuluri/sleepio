import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { motion, Reorder } from "framer-motion";
import { Plus, Trash2, Sparkles, CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "../lib/utils";
import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { ExamModeTab } from "../components/exam-mode";
import { Calendar } from "../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  createExam,
  createIA,
  deleteExam,
  deleteIA,
  generateStudyPlan,
  getActiveStudyPlan,
  listExams,
  listIAs,
  saveStudyPlan,
  updateIAStatus,
} from "../lib/api/academics.functions";

export const Route = createFileRoute("/academics")({
  head: () => ({
    meta: [
      { title: "Academics — SleepIO" },
      { name: "description", content: "Track IAs, exams, and build your study plan." },
    ],
  }),
  component: AcademicsPage,
});

type IA = {
  id: string;
  subject: string;
  ia_type: string;
  due_date: string;
  status: "not_started" | "in_progress" | "submitted";
  notes: string | null;
};

type Exam = {
  id: string;
  subject: string;
  exam_date: string;
  exam_board: string;
  paper_type: string;
};

type StudyBlock = { subject: string; minutes: number; focus: string };
type StudyDay = { date: string; blocks: StudyBlock[] };
type StudyWeek = { start: string; days: StudyDay[] };
type StudyPlan = { weeks: StudyWeek[] };

function AcademicsPage() {
  return (
    <AppShell subtitle="IB & IGCSE" title="Academics">
      <Tabs defaultValue="ia" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="ia">Internal Assessments</TabsTrigger>
          <TabsTrigger value="exams">Summative Exams</TabsTrigger>
          <TabsTrigger value="exam-mode">Exam Mode</TabsTrigger>
        </TabsList>
        <TabsContent value="ia" className="mt-4">
          <IATab />
        </TabsContent>
        <TabsContent value="exams" className="mt-4">
          <ExamsTab />
        </TabsContent>
        <TabsContent value="exam-mode" className="mt-4">
          <ExamModeTab />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function daysUntil(date: string): number {
  const d = new Date(date + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

const STATUS_PROGRESS = { not_started: 0, in_progress: 0.5, submitted: 1 };
const STATUS_LABEL = { not_started: "Not Started", in_progress: "In Progress", submitted: "Submitted" };

function IATab() {
  const list = useServerFn(listIAs);
  const create = useServerFn(createIA);
  const del = useServerFn(deleteIA);
  const upd = useServerFn(updateIAStatus);

  const [items, setItems] = useState<IA[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", ia_type: "test", due_date: "", notes: "" });

  const reload = async () => {
    try {
      const r = await list();
      setItems((r.ias as IA[]) ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => { void reload(); }, []);

  const onCreate = async () => {
    if (!form.subject || !form.due_date) {
      toast.error("Subject and due date are required");
      return;
    }
    try {
      await create({ data: { ...form, notes: form.notes || null } });
      toast.success("IA added");
      setOpen(false);
      setForm({ subject: "", ia_type: "test", due_date: "", notes: "" });
      void reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await del({ data: { id } });
      void reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onCycleStatus = async (ia: IA) => {
    const next: IA["status"] =
      ia.status === "not_started" ? "in_progress" : ia.status === "in_progress" ? "submitted" : "not_started";
    setItems((prev) => prev.map((x) => (x.id === ia.id ? { ...x, status: next } : x)));
    try { await upd({ data: { id: ia.id, status: next } }); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} assessment{items.length === 1 ? "" : "s"}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add IA</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Internal Assessment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mathematics HL" />
              </div>
              <div>
                <Label>IA type</Label>
                <Select value={form.ia_type} onValueChange={(v) => setForm({ ...form, ia_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="test">Test</SelectItem>
                    <SelectItem value="submission">Submission</SelectItem>
                    <SelectItem value="oral">Oral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onCreate}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No IAs yet. Add one to start tracking due dates.
        </div>
      )}

      {items.map((ia) => {
        const days = daysUntil(ia.due_date);
        const reminder = days <= 1 ? "Due tomorrow" : days <= 3 ? `Due in ${days} days` : days <= 7 ? "Due this week" : null;
        const pct = STATUS_PROGRESS[ia.status];
        return (
          <div key={ia.id} className="rounded-2xl border border-border bg-surface p-3">
            <div className="flex items-start gap-3">
              <ProgressRing pct={pct} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{ia.subject}</p>
                <p className="text-xs text-muted-foreground">{ia.ia_type} · due {ia.due_date}</p>
                <button
                  type="button"
                  onClick={() => onCycleStatus(ia)}
                  className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium"
                >
                  {STATUS_LABEL[ia.status]}
                </button>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this IA?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(ia.id)}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            {reminder && (
              <div className="mt-2 rounded-lg bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                ⚠ {reminder}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const R = 16;
  const C = 2 * Math.PI * R;
  return (
    <svg className="h-10 w-10 -rotate-90" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={R} fill="none" stroke="var(--border)" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={R}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - pct)}
      />
    </svg>
  );
}

function ExamsTab() {
  const list = useServerFn(listExams);
  const create = useServerFn(createExam);
  const del = useServerFn(deleteExam);
  const gen = useServerFn(generateStudyPlan);
  const save = useServerFn(saveStudyPlan);
  const getPlan = useServerFn(getActiveStudyPlan);

  const [exams, setExams] = useState<Exam[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", exam_date: "", exam_board: "IB" as "IB" | "IGCSE", paper_type: "Paper 1" });
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [generating, setGenerating] = useState(false);

  const reload = async () => {
    try {
      const r = await list();
      setExams((r.exams as Exam[]) ?? []);
    } catch {}
    try {
      const p = await getPlan();
      if (p.plan) setPlan(p.plan as StudyPlan);
    } catch {}
  };

  useEffect(() => { void reload(); }, []);

  const onCreate = async () => {
    if (!form.subject || !form.exam_date) {
      toast.error("Subject and date required");
      return;
    }
    try {
      await create({ data: form });
      toast.success("Exam added");
      setOpen(false);
      setForm({ subject: "", exam_date: "", exam_board: "IB", paper_type: "Paper 1" });
      void reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (id: string) => {
    try { await del({ data: { id } }); void reload(); } catch (e) { toast.error((e as Error).message); }
  };

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const r = await gen({
        data: {
          exams: exams.map((e) => ({
            subject: e.subject, exam_date: e.exam_date, exam_board: e.exam_board, paper_type: e.paper_type,
          })),
          weeksAvailable: 4,
          hoursPerDay: 2,
          weakSubjects: [],
        },
      });
      setPlan(r.plan as StudyPlan);
      try { await save({ data: { plan: r.plan as StudyPlan } }); } catch {}
      toast.success("Study plan generated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const examDates = useMemo(() => new Set(exams.map((e) => e.exam_date)), [exams]);
  const examSubjectDeadlines = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of exams) {
      const prev = m.get(e.subject);
      if (!prev || e.exam_date < prev) m.set(e.subject, e.exam_date);
    }
    return m;
  }, [exams]);

  const persistPlan = async (next: StudyPlan) => {
    setPlan(next);
    try {
      await save({ data: { plan: next } });
      toast.success("Study plan updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{exams.length} exam{exams.length === 1 ? "" : "s"}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Add Exam</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Exam</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Subject</Label>
                <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <Label>Exam date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.exam_date && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.exam_date
                        ? format(new Date(form.exam_date + "T00:00:00"), "PPP")
                        : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.exam_date ? new Date(form.exam_date + "T00:00:00") : undefined}
                      onSelect={(d) =>
                        setForm({
                          ...form,
                          exam_date: d
                            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                            : "",
                        })
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Exam board</Label>
                <Select value={form.exam_board} onValueChange={(v) => setForm({ ...form, exam_board: v as "IB" | "IGCSE" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IB">IB</SelectItem>
                    <SelectItem value="IGCSE">IGCSE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Paper type</Label>
                <Select value={form.paper_type} onValueChange={(v) => setForm({ ...form, paper_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paper 1">Paper 1</SelectItem>
                    <SelectItem value="Paper 2">Paper 2</SelectItem>
                    <SelectItem value="Oral">Oral</SelectItem>
                    <SelectItem value="Practical">Practical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter><Button onClick={onCreate}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* horizontal exam timeline */}
      <div className="overflow-x-auto">
        <div className="flex min-w-full gap-2 pb-2">
          {exams.length === 0 && (
            <div className="w-full rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No exams scheduled yet.
            </div>
          )}
          {exams.map((e) => (
            <div key={e.id} className="min-w-[160px] rounded-2xl border border-border bg-surface p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{e.exam_board}</p>
              <p className="mt-1 text-sm font-semibold">{e.subject}</p>
              <p className="text-xs text-muted-foreground">{e.paper_type}</p>
              <p className="mt-2 text-xs font-medium">{e.exam_date}</p>
              <button type="button" onClick={() => onDelete(e.id)} className="mt-2 text-[11px] text-destructive">Delete</button>
            </div>
          ))}
        </div>
      </div>

      {exams.length > 0 && (
        <Button onClick={onGenerate} disabled={generating} className="w-full">
          <Sparkles className="mr-2 h-4 w-4" />
          {generating ? "Generating…" : plan ? "Regenerate Study Plan" : "Generate Study Plan"}
        </Button>
      )}

      {plan && (
        <StudyPlanGrid
          plan={plan}
          examDates={examDates}
          subjectDeadlines={examSubjectDeadlines}
          onChange={persistPlan}
        />
      )}
    </div>
  );
}

function StudyPlanGrid({
  plan,
  examDates,
  subjectDeadlines,
  onChange,
}: {
  plan: StudyPlan;
  examDates: Set<string>;
  subjectDeadlines: Map<string, string>;
  onChange: (next: StudyPlan) => void;
}) {
  const update = (mutate: (p: StudyPlan) => StudyPlan) => onChange(mutate(structuredClone(plan)));

  return (
    <div className="space-y-4">
      {plan.weeks.map((week, wi) => (
        <div key={`${week.start}-${wi}`} className="rounded-2xl border border-border bg-surface p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Week of {week.start}
          </p>
          <div className="mt-2 grid gap-2">
            {week.days.map((day, di) => {
              const isExamDay = examDates.has(day.date);
              return (
                <div
                  key={day.date}
                  onDragOver={(e) => {
                    if (isExamDay) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (isExamDay) {
                      toast.error("Can't drop on an exam day");
                      return;
                    }
                    try {
                      const payload = JSON.parse(e.dataTransfer.getData("text/plain")) as {
                        wi: number;
                        di: number;
                        bi: number;
                      };
                      if (payload.wi === wi && payload.di === di) return;
                      const src = plan.weeks[payload.wi]?.days[payload.di]?.blocks[payload.bi];
                      if (!src) return;
                      const deadline = subjectDeadlines.get(src.subject);
                      if (deadline && day.date > deadline) {
                        toast.error("Past subject's exam date");
                        return;
                      }
                      update((p) => {
                        const [moved] = p.weeks[payload.wi].days[payload.di].blocks.splice(payload.bi, 1);
                        p.weeks[wi].days[di].blocks.push(moved);
                        return p;
                      });
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`rounded-xl border p-2 ${isExamDay ? "border-destructive/40 bg-destructive/5" : "border-border bg-background"}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-muted-foreground">{day.date}</span>
                    {isExamDay && <span className="text-[10px] font-semibold text-destructive">EXAM DAY</span>}
                  </div>
                  {day.blocks.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">—</p>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={day.blocks}
                      onReorder={(next) =>
                        update((p) => {
                          p.weeks[wi].days[di].blocks = next as StudyBlock[];
                          return p;
                        })
                      }
                      className="space-y-1"
                    >
                      {day.blocks.map((b, bi) => (
                        <Reorder.Item
                          key={`${b.subject}-${bi}-${b.focus}`}
                          value={b}
                          className="cursor-grab rounded-md bg-primary/10 px-2 py-1 text-[11px]"
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", JSON.stringify({ wi, di, bi }));
                            }}
                          >
                            <span className="font-medium">📚 {b.subject}</span>
                            <span className="ml-2 text-muted-foreground">{b.minutes}m · {b.focus}</span>
                          </div>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

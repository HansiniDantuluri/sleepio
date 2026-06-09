import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import { Lock, Plus, Trash2, ArrowLeft, ArrowRight, Sparkles, Pencil, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "../components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { generateSchedule, saveActiveSchedule } from "../lib/api/schedule.functions";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan — SleepIO" },
      { name: "description", content: "Your day, planned around sleep and study." },
    ],
  }),
  component: PlanPage,
});

type Priority = "high" | "medium" | "low";
type TaskType = "Homework" | "IA Work" | "Exam Revision" | "Assignment" | "Class" | "Personal";

type Task = {
  id: string;
  name: string;
  type: TaskType;
  deadline: string;
  durationMin: number;
  priority: Priority;
};

type Block = {
  startTime: string;
  endTime: string;
  taskName: string;
  type: string;
  color: "red" | "yellow" | "blue" | "purple" | "indigo" | "gray";
  isLocked: boolean;
  rationale: string;
};

const TASK_TYPES: TaskType[] = ["Homework", "IA Work", "Exam Revision", "Assignment", "Class", "Personal"];
const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15);

function PlanPage() {
  const [step, setStep] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sleepGoal, setSleepGoal] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("06:00");
  const [energy, setEnergy] = useState<"low" | "medium" | "high">("medium");
  const [intensity, setIntensity] = useState(3);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const [warning, setWarning] = useState<string | null>(null);

  const fetchSchedule = useServerFn(generateSchedule);
  const saveSchedule = useServerFn(saveActiveSchedule);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      setSleepGoal(localStorage.getItem("sleep_goal_time") || "22:00");
      setWakeTime(localStorage.getItem("wake_time") || "06:00");
    } catch {
      /* ignore */
    }
  }, []);

  const goNext = () => setStep((s) => Math.min(5, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const runGeneration = async () => {
    setStep(3);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetchSchedule({
        data: {
          tasks,
          preferences: { sleepGoalTime: sleepGoal, wakeTime, energy, intensity, date: today },
        },
      });
      // detect pushed tasks
      const taskNames = new Set(tasks.map((t) => t.name));
      const scheduled = new Set(res.blocks.map((b) => b.taskName));
      const pushed = [...taskNames].filter((n) => !scheduled.has(n));
      if (pushed.length) {
        setWarning("Some tasks moved to tomorrow to protect your sleep");
      } else {
        setWarning(null);
      }
      setBlocks(res.blocks);
      setStep(4);
    } catch (e) {
      toast.error("Could not generate schedule");
      setStep(2);
    }
  };

  const handleSave = async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      await saveSchedule({
        data: {
          tasks,
          blocks,
          preferences: { sleepGoalTime: sleepGoal, wakeTime, energy, intensity, date: today },
        },
      });
      toast.success("Schedule saved & set active");
      navigate({ to: "/" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Save failed";
      if (/unauthorized/i.test(msg)) {
        toast.error("Sign in to save your schedule");
        navigate({ to: "/auth" });
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <AppShell subtitle={`Step ${step} of 5`} title="Plan My Day">
      <div className="space-y-5">
        <StepDots step={step} />
        <AnimatePresence mode="wait">
          {step === 1 && (
            <Motion key="s1">
              <TaskInputStep tasks={tasks} setTasks={setTasks} />
              <NavRow onNext={tasks.length ? goNext : undefined} />
            </Motion>
          )}
          {step === 2 && (
            <Motion key="s2">
              <PrefsStep
                sleepGoal={sleepGoal}
                setSleepGoal={setSleepGoal}
                energy={energy}
                setEnergy={setEnergy}
                intensity={intensity}
                setIntensity={setIntensity}
              />
              <NavRow onBack={goBack} onNext={runGeneration} nextLabel="Generate" />
            </Motion>
          )}
          {step === 3 && (
            <Motion key="s3">
              <GeneratingStep />
            </Motion>
          )}
          {step === 4 && (
            <Motion key="s4">
              {warning && <WarningBanner text={warning} />}
              <ScheduleView blocks={blocks} highlightIds={changedIds} />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setStep(5)}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" /> Save & Set Active
                </Button>
              </div>
            </Motion>
          )}
          {step === 5 && (
            <Motion key="s5">
              <EditableSchedule
                blocks={blocks}
                onChange={(next, changed) => {
                  setBlocks(next);
                  setChangedIds(changed);
                  setTimeout(() => setChangedIds(new Set()), 1200);
                }}
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setStep(4)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 h-4 w-4" /> Save Schedule
                </Button>
              </div>
            </Motion>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

function Motion({ children, ...rest }: { children: React.ReactNode; key?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <div
          key={s}
          className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

function NavRow({ onBack, onNext, nextLabel = "Next" }: { onBack?: () => void; onNext?: () => void; nextLabel?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      {onBack && (
        <Button variant="outline" className="flex-1" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      )}
      <Button className="flex-1" onClick={onNext} disabled={!onNext}>
        {nextLabel} <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function TaskInputStep({ tasks, setTasks }: { tasks: Task[]; setTasks: (t: Task[]) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<TaskType>("Homework");
  const [deadline, setDeadline] = useState("");
  const [duration, setDuration] = useState(60);
  const [priority, setPriority] = useState<Priority>("medium");

  const add = () => {
    if (!name.trim()) return;
    setTasks([
      ...tasks,
      { id: crypto.randomUUID(), name: name.trim(), type, deadline, durationMin: duration, priority },
    ]);
    setName("");
    setDeadline("");
    setDuration(60);
    setPriority("medium");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-3xl border border-border bg-surface p-4">
        <div>
          <Label htmlFor="task-name">Task</Label>
          <Input id="task-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Math past paper" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as TaskType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label>Duration</Label>
            <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d < 60 ? `${d}m` : `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ""}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={add} className="w-full" variant="secondary">
          <Plus className="mr-2 h-4 w-4" /> Add task
        </Button>
      </div>

      <div className="max-h-[260px] space-y-2 overflow-y-auto">
        {tasks.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Add at least one task to continue
          </p>
        )}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
            <div className={`h-2 w-2 rounded-full ${t.priority === "high" ? "bg-destructive" : t.priority === "medium" ? "bg-[oklch(0.78_0.15_70)]" : "bg-[oklch(0.7_0.15_235)]"}`} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {t.type} · {t.durationMin}m {t.deadline ? `· due ${t.deadline}` : ""}
              </p>
            </div>
            <button
              onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              aria-label="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrefsStep({
  sleepGoal,
  setSleepGoal,
  energy,
  setEnergy,
  intensity,
  setIntensity,
}: {
  sleepGoal: string;
  setSleepGoal: (v: string) => void;
  energy: "low" | "medium" | "high";
  setEnergy: (v: "low" | "medium" | "high") => void;
  intensity: number;
  setIntensity: (v: number) => void;
}) {
  const energyNum = energy === "low" ? 0 : energy === "medium" ? 1 : 2;
  return (
    <div className="space-y-5 rounded-3xl border border-border bg-surface p-5">
      <div>
        <Label htmlFor="sleep">Tonight's sleep goal</Label>
        <Input id="sleep" type="time" value={sleepGoal} onChange={(e) => setSleepGoal(e.target.value)} />
      </div>
      <div>
        <Label>Current energy</Label>
        <div className="mt-2">
          <Slider
            min={0}
            max={2}
            step={1}
            value={[energyNum]}
            onValueChange={(v) => setEnergy((["low", "medium", "high"] as const)[v[0]])}
          />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Low</span><span>Medium</span><span>High</span>
          </div>
        </div>
      </div>
      <div>
        <Label>Work intensity: {intensity}</Label>
        <div className="mt-2">
          <Slider min={1} max={5} step={1} value={[intensity]} onValueChange={(v) => setIntensity(v[0])} />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Light</span><span>Intense</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GeneratingStep() {
  const messages = useMemo(
    () => [
      "Collecting your tasks…",
      "Checking your sleep goal…",
      "Building your schedule…",
      "Optimizing for sleep…",
      "Almost done…",
    ],
    [],
  );
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, messages.length - 1)), 900);
    return () => clearInterval(id);
  }, [messages.length]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-brand"
      >
        <Sparkles className="h-8 w-8" />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="text-center font-display text-lg text-foreground"
        >
          {messages[i]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function colorClasses(color: Block["color"]) {
  switch (color) {
    case "red":
      return "bg-[oklch(0.95_0.08_25)] dark:bg-[oklch(0.4_0.15_25)]";
    case "yellow":
      return "bg-[oklch(0.96_0.1_90)] dark:bg-[oklch(0.4_0.1_90)]";
    case "blue":
      return "bg-[oklch(0.93_0.07_235)] dark:bg-[oklch(0.38_0.1_235)]";
    case "purple":
      return "bg-[oklch(0.88_0.06_295)] dark:bg-[oklch(0.38_0.1_295)]";
    case "indigo":
      return "bg-[oklch(0.25_0.08_270)] text-white";
    default:
      return "bg-muted";
  }
}

function ScheduleView({ blocks, highlightIds }: { blocks: Block[]; highlightIds: Set<string> }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-semibold">Your schedule</h2>
      <div className="space-y-2">
        {blocks.map((b, idx) => (
          <motion.div
            key={`${b.startTime}-${idx}`}
            animate={highlightIds.has(`${b.startTime}-${idx}`) ? { backgroundColor: ["oklch(0.96 0.12 95)", "oklch(0.96 0.05 95 / 0)"] } : {}}
            transition={{ duration: 1.2 }}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${colorClasses(b.color)}`}
          >
            {b.isLocked && <Lock className="h-4 w-4 opacity-80" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.taskName}</p>
              <p className="text-[11px] opacity-80">
                {b.startTime}–{b.endTime} · {b.type}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function EditableSchedule({
  blocks,
  onChange,
}: {
  blocks: Block[];
  onChange: (next: Block[], changed: Set<string>) => void;
}) {
  const lockedIdx = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.isLocked);
  const movable = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !b.isLocked);
  const [items, setItems] = useState(movable.map((m) => m.b));

  useEffect(() => {
    setItems(blocks.filter((b) => !b.isLocked));
  }, [blocks]);

  return (
    <div className="rounded-3xl border border-border bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-semibold">Drag to reorder</h2>
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={(next) => {
          setItems(next);
          // rebuild with locked items appended at original positions (sleep/wind at end)
          const locked = lockedIdx.map(({ b }) => b);
          const merged = [...next, ...locked];
          const changed = new Set<string>();
          merged.forEach((b, idx) => changed.add(`${b.startTime}-${idx}`));
          onChange(merged, changed);
        }}
        className="space-y-2"
      >
        {items.map((b) => (
          <Reorder.Item
            key={`${b.startTime}-${b.taskName}`}
            value={b}
            className={`flex cursor-grab items-center gap-3 rounded-2xl px-3 py-3 active:cursor-grabbing ${colorClasses(b.color)}`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.taskName}</p>
              <p className="text-[11px] opacity-80">
                {b.startTime}–{b.endTime} · {b.type}
              </p>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <div className="mt-3 space-y-2">
        {lockedIdx.map(({ b }, i) => (
          <div key={i} className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${colorClasses(b.color)}`}>
            <Lock className="h-4 w-4 opacity-80" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{b.taskName}</p>
              <p className="text-[11px] opacity-80">{b.startTime}–{b.endTime} · locked</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WarningBanner({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{text}</p>
    </motion.div>
  );
}
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "../components/theme-toggle";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome to SleepIO — Set up your plan" },
      { name: "description", content: "Tell us about your sleep, schedule, and study goals." },
    ],
  }),
  component: OnboardingPage,
});

const STORAGE_KEY = "onboarding_draft";

type Draft = {
  goal?: string;
  sleep_goal_time?: string;
  wake_time?: string;
  school_start?: string;
  school_end?: string;
  extracurriculars?: string;
  curriculum?: "IB" | "IGCSE";
  subjects?: string[];
  struggles?: string[];
  energy_pattern?: string;
};

const DEFAULTS = {
  sleep_goal_time: "22:00",
  wake_time: "06:00",
  school_start: "08:00",
  school_end: "15:00",
} as const;

function loadDraft(): Draft {
  if (typeof window === "undefined") {
    return { ...DEFAULTS };
  }
  let stored: Draft = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    stored = {};
  }
  return {
    ...DEFAULTS,
    ...stored,
  };
}

function saveDraft(d: Draft) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(() => loadDraft());

  // Persist seeded defaults immediately so ThemeProvider auto-switch
  // works even if the user accepts defaults without touching inputs.
  useEffect(() => {
    saveDraft(draft);
    if (draft.sleep_goal_time) {
      localStorage.setItem("sleep_goal_time", draft.sleep_goal_time);
    }
    if (draft.wake_time) {
      localStorage.setItem("wake_time", draft.wake_time);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<Draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    saveDraft(next);
  };

  const next = () => setStep((s) => Math.min(5, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const finish = () => {
    saveDraft(draft);
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
        <header className="flex items-center justify-between px-5 pb-2 pt-8">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Step {step} of 5
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">
              {titles[step - 1]}
            </h1>
          </div>
          <ThemeToggle />
        </header>
        <div className="px-5">
          <Progress value={(step / 5) * 100} />
        </div>
        <main className="flex-1 px-5 pb-6 pt-6">
          {step === 1 && <StepGoal value={draft.goal} onChange={(v) => update({ goal: v })} />}
          {step === 2 && (
            <StepSleep
              sleep={draft.sleep_goal_time ?? "22:00"}
              wake={draft.wake_time ?? "06:00"}
              onChange={(sleep, wake) => {
                update({ sleep_goal_time: sleep, wake_time: wake });
                // Persist immediately so ThemeProvider auto-switch picks them up
                localStorage.setItem("sleep_goal_time", sleep);
                localStorage.setItem("wake_time", wake);
              }}
            />
          )}
          {step === 3 && (
            <StepSchedule
              draft={draft}
              onChange={(patch) => update(patch)}
            />
          )}
          {step === 4 && (
            <StepStruggles
              value={draft.struggles ?? []}
              onChange={(v) => update({ struggles: v })}
            />
          )}
          {step === 5 && (
            <StepEnergy value={draft.energy_pattern} onChange={(v) => update({ energy_pattern: v })} />
          )}
        </main>
        <footer className="sticky bottom-0 flex gap-3 border-t border-border bg-background/80 px-5 py-4 backdrop-blur">
          {step > 1 && (
            <button
              onClick={back}
              className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground"
            >
              Back
            </button>
          )}
          {step < 5 ? (
            <button
              onClick={next}
              disabled={!canAdvance(step, draft)}
              className="flex-[2] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={!canAdvance(5, draft)}
              className="flex-[2] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Create account
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

const titles = [
  "What's your main goal?",
  "Your sleep window",
  "Your day",
  "What gets in your way?",
  "When do you feel sharpest?",
];

function canAdvance(step: number, d: Draft): boolean {
  switch (step) {
    case 1: return !!d.goal;
    case 2: return !!d.sleep_goal_time && !!d.wake_time;
    case 3: return !!d.curriculum && (d.subjects?.length ?? 0) > 0;
    case 4: return (d.struggles?.length ?? 0) > 0;
    case 5: return !!d.energy_pattern;
    default: return false;
  }
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
      <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function Card({ children, selected, onClick }: { children: ReactNode; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left text-sm transition ${
        selected
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-surface text-foreground hover:border-primary/40"
      }`}
    >
      {children}
    </button>
  );
}

function StepGoal({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const goals = [
    { id: "better-sleep", label: "Sleep better", desc: "Build a consistent wind-down routine." },
    { id: "focus", label: "Focus during study", desc: "Beat procrastination and distractions." },
    { id: "grades", label: "Improve grades", desc: "Structure your week around what matters." },
    { id: "balance", label: "Find balance", desc: "Less burnout, more energy." },
  ];
  return (
    <div className="space-y-3">
      {goals.map((g) => (
        <Card key={g.id} selected={value === g.id} onClick={() => onChange(g.id)}>
          <p className="font-semibold">{g.label}</p>
          <p className="mt-1 text-muted-foreground">{g.desc}</p>
        </Card>
      ))}
    </div>
  );
}

function StepSleep({
  sleep,
  wake,
  onChange,
}: {
  sleep: string;
  wake: string;
  onChange: (sleep: string, wake: string) => void;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Sleep mode will turn on one hour before your sleep goal and switch off when you wake.
      </p>
      <TimeField label="Sleep goal" value={sleep} onChange={(v) => onChange(v, wake)} />
      <TimeField label="Wake time" value={wake} onChange={(v) => onChange(sleep, v)} />
    </div>
  );
}

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-lg font-semibold text-foreground"
      />
    </label>
  );
}

function StepSchedule({ draft, onChange }: { draft: Draft; onChange: (p: Partial<Draft>) => void }) {
  const subjectOptions = [
    "Maths", "Physics", "Chemistry", "Biology", "English", "History",
    "Geography", "Economics", "Computer Science", "Languages", "Arts",
  ];
  const subjects = draft.subjects ?? [];
  const toggle = (s: string) =>
    onChange({
      subjects: subjects.includes(s) ? subjects.filter((x) => x !== s) : [...subjects, s],
    });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <TimeField
          label="School start"
          value={draft.school_start ?? "08:00"}
          onChange={(v) => onChange({ school_start: v })}
        />
        <TimeField
          label="School end"
          value={draft.school_end ?? "15:30"}
          onChange={(v) => onChange({ school_end: v })}
        />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Extracurriculars
        </span>
        <input
          type="text"
          placeholder="e.g. football Tue/Thu 5–6pm"
          value={draft.extracurriculars ?? ""}
          onChange={(e) => onChange({ extracurriculars: e.target.value })}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
        />
      </label>
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Curriculum
        </span>
        <div className="grid grid-cols-2 gap-3">
          {(["IB", "IGCSE"] as const).map((c) => (
            <Card key={c} selected={draft.curriculum === c} onClick={() => onChange({ curriculum: c })}>
              <p className="text-center font-semibold">{c}</p>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Subjects
        </span>
        <div className="flex flex-wrap gap-2">
          {subjectOptions.map((s) => {
            const on = subjects.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-foreground"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepStruggles({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const options = [
    "Falling asleep", "Waking up tired", "Procrastination", "Phone distraction",
    "Exam anxiety", "Inconsistent schedule", "Too many late nights", "Low energy in class",
  ];
  const toggle = (s: string) =>
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Pick all that apply.</p>
      {options.map((o) => (
        <Card key={o} selected={value.includes(o)} onClick={() => toggle(o)}>
          <p className="font-medium">{o}</p>
        </Card>
      ))}
    </div>
  );
}

function StepEnergy({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const opts = [
    { id: "morning", label: "Early bird", desc: "Sharpest before noon." },
    { id: "afternoon", label: "Afternoon peak", desc: "Hit my stride after lunch." },
    { id: "evening", label: "Night owl", desc: "Most focused in the evening." },
    { id: "varies", label: "It varies", desc: "Depends on the day." },
  ];
  return (
    <div className="space-y-3">
      {opts.map((o) => (
        <Card key={o.id} selected={value === o.id} onClick={() => onChange(o.id)}>
          <p className="font-semibold">{o.label}</p>
          <p className="mt-1 text-muted-foreground">{o.desc}</p>
        </Card>
      ))}
    </div>
  );
}
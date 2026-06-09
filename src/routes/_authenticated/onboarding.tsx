import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [{ title: "Welcome to SleepIO" }],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  const [grade, setGrade] = useState<9 | 10 | 11 | 12>(11);
  const [curriculum, setCurriculum] = useState<"IB" | "IGCSE">("IB");
  const [sleepGoal, setSleepGoal] = useState("22:30");
  const [wake, setWake] = useState("06:30");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        grade,
        curriculum,
        sleep_goal_time: sleepGoal,
        wake_time: wake,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    // Persist for ThemeProvider auto-switch
    localStorage.setItem("sleep_goal_time", sleepGoal);
    localStorage.setItem("wake_time", wake);
    window.dispatchEvent(new Event("sleepio:schedule-changed"));

    navigate({ to: "/" });
  };

  return (
    <div className="min-h-dvh bg-background px-5 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-[0_10px_30px_-10px_var(--brand)]">
            <Moon className="h-6 w-6" />
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Let's set you up</h1>
          <p className="text-sm text-muted-foreground">A few quick details so SleepIO can tailor your plan.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <section>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Grade</p>
            <div className="grid grid-cols-4 gap-2">
              {[9, 10, 11, 12].map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setGrade(g as 9 | 10 | 11 | 12)}
                  className={
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
                    (grade === g
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-surface text-foreground hover:bg-muted")
                  }
                >
                  {g}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Curriculum</p>
            <div className="grid grid-cols-2 gap-2">
              {(["IB", "IGCSE"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCurriculum(c)}
                  className={
                    "rounded-xl border px-3 py-2.5 text-sm font-semibold transition " +
                    (curriculum === c
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border bg-surface text-foreground hover:bg-muted")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <TimeField label="Target bedtime" value={sleepGoal} onChange={setSleepGoal} />
            <TimeField label="Wake-up time" value={wake} onChange={setWake} />
          </section>

          <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            SleepIO will auto-switch to Sleep mode one hour before your bedtime and back to Productivity mode at your wake time.
          </p>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-foreground shadow-[0_10px_30px_-12px_var(--brand)] transition hover:opacity-95 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Start using SleepIO
          </button>
        </form>
      </div>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type="time"
        value={value}
        required
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-input bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
    </label>
  );
}
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { LogOut, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "../components/app-shell";
import { useTheme, type ThemeMode } from "../components/theme-provider";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { Slider } from "../components/ui/slider";
import { Label } from "../components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  getSettings,
  updateProfileFields,
  upsertUserSettings,
  type UserSettings,
} from "../lib/api/settings.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SleepIO" },
      { name: "description", content: "Sleep, academic, theme, and notification preferences." },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-5">
      <h2 className="mb-4 font-display text-lg font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const { mode, setMode } = useTheme();
  const fetchSettings = useServerFn(getSettings);
  const saveProfile = useServerFn(updateProfileFields);
  const saveSettings = useServerFn(upsertUserSettings);

  const [loaded, setLoaded] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [sleepGoalTime, setSleepGoalTime] = useState("22:00");
  const [wakeTime, setWakeTime] = useState("06:00");
  const [curriculum, setCurriculum] = useState<"IB" | "IGCSE">("IB");
  const [settings, setSettings] = useState<UserSettings>({
    sleep_target_minutes: 480,
    subjects: [],
    notifications: {
      ia_reminders: true,
      sleep_reminder: true,
      focus_reminders: true,
      ia_lead_days: [7, 3, 1],
    },
    app_blocking: false,
  });
  const [newSubject, setNewSubject] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((res) => {
        if (cancelled) return;
        if (res.profile) {
          setFullName(res.profile.full_name ?? "");
          setEmail(res.profile.email ?? "");
          setSleepGoalTime((res.profile.sleep_goal_time ?? "22:00:00").slice(0, 5));
          setWakeTime((res.profile.wake_time ?? "06:00:00").slice(0, 5));
          setCurriculum((res.profile.curriculum as "IB" | "IGCSE") ?? "IB");
        }
        setSettings(res.settings);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [fetchSettings]);

  const persistProfile = async (patch: Record<string, string>) => {
    try {
      await saveProfile({ data: patch });
    } catch {
      toast.error("Couldn't save");
    }
  };
  const persistSettings = async (patch: Partial<UserSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    try {
      await saveSettings({ data: patch });
    } catch {
      toast.error("Couldn't save");
    }
  };

  const handleSleepGoal = (v: string) => {
    setSleepGoalTime(v);
    try { localStorage.setItem("sleep_goal_time", v); } catch {}
    void persistProfile({ sleep_goal_time: `${v}:00` });
  };
  const handleWake = (v: string) => {
    setWakeTime(v);
    try { localStorage.setItem("wake_time", v); } catch {}
    void persistProfile({ wake_time: `${v}:00` });
  };

  const handleAddSubject = () => {
    const s = newSubject.trim();
    if (!s || settings.subjects.includes(s)) return;
    void persistSettings({ subjects: [...settings.subjects, s] });
    setNewSubject("");
  };
  const handleRemoveSubject = (s: string) => {
    void persistSettings({ subjects: settings.subjects.filter((x) => x !== s) });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  };

  const themeOptions: { value: ThemeMode; label: string; desc: string }[] = [
    { value: "auto", label: "Auto", desc: "Switches based on sleep/wake times" },
    { value: "productivity", label: "Productivity", desc: "Bright, focused theme" },
    { value: "sleep", label: "Sleep Mode", desc: "Dim, evening-friendly" },
  ];

  if (!loaded) {
    return (
      <AppShell title="Settings" subtitle="Preferences">
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-3xl bg-muted/60" />
          <div className="h-32 animate-pulse rounded-3xl bg-muted/60" />
        </div>
      </AppShell>
    );
  }

  const targetH = (settings.sleep_target_minutes / 60).toFixed(1);

  return (
    <AppShell title="Settings" subtitle="Preferences">
      <div className="space-y-5">
        <Section title="Sleep">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sleep goal time</Label>
              <Input
                type="time"
                value={sleepGoalTime}
                onChange={(e) => handleSleepGoal(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Wake time</Label>
              <Input
                type="time"
                value={wakeTime}
                onChange={(e) => handleWake(e.target.value)}
              />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs">Sleep duration target</Label>
              <span className="text-sm font-semibold">{targetH}h</span>
            </div>
            <Slider
              value={[settings.sleep_target_minutes]}
              min={360}
              max={600}
              step={15}
              onValueChange={(v) => setSettings((s) => ({ ...s, sleep_target_minutes: v[0] }))}
              onValueCommit={(v) => persistSettings({ sleep_target_minutes: v[0] })}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>6h</span><span>10h</span>
            </div>
          </div>
        </Section>

        <Section title="Academic">
          <div>
            <Label className="text-xs">Curriculum</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["IB", "IGCSE"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCurriculum(c);
                    void persistProfile({ curriculum: c });
                  }}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                    curriculum === c
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Subjects</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {settings.subjects.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground"
                >
                  {s}
                  <button onClick={() => handleRemoveSubject(s)} aria-label={`Remove ${s}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {settings.subjects.length === 0 && (
                <span className="text-xs text-muted-foreground">No subjects yet.</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Add subject"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
              />
              <Button onClick={handleAddSubject} variant="secondary">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Section>

        <Section title="Theme">
          <div className="space-y-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setMode(opt.value);
                  void persistProfile({ theme_mode: opt.value });
                }}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  mode === opt.value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/40"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.desc}</p>
                </div>
                <span
                  className={`h-4 w-4 rounded-full border-2 ${
                    mode === opt.value ? "border-primary bg-primary" : "border-border"
                  }`}
                />
              </button>
            ))}
          </div>
        </Section>

        <Section title="Notifications">
          <ToggleRow
            label="IA deadline reminders"
            desc={`Lead days: ${settings.notifications.ia_lead_days.join(", ")}`}
            checked={settings.notifications.ia_reminders}
            onChange={(v) =>
              persistSettings({
                notifications: { ...settings.notifications, ia_reminders: v },
              })
            }
          />
          <ToggleRow
            label="Sleep reminder"
            desc="30 min before sleep goal"
            checked={settings.notifications.sleep_reminder}
            onChange={(v) =>
              persistSettings({
                notifications: { ...settings.notifications, sleep_reminder: v },
              })
            }
          />
          <ToggleRow
            label="Focus session reminders"
            desc="Nudges to start a focus session"
            checked={settings.notifications.focus_reminders}
            onChange={(v) =>
              persistSettings({
                notifications: { ...settings.notifications, focus_reminders: v },
              })
            }
          />
          {settings.notifications.ia_reminders && (
            <div>
              <Label className="text-xs">IA reminder lead days</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 3, 7, 14].map((d) => {
                  const on = settings.notifications.ia_lead_days.includes(d);
                  return (
                    <button
                      key={d}
                      onClick={() =>
                        persistSettings({
                          notifications: {
                            ...settings.notifications,
                            ia_lead_days: on
                              ? settings.notifications.ia_lead_days.filter((x) => x !== d)
                              : [...settings.notifications.ia_lead_days, d].sort((a, b) => b - a),
                          },
                        })
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      {d}d
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        <Section title="Sleep enforcement">
          <ToggleRow
            label="Sleep enforcement overlay"
            desc="Show a full-screen reminder once your sleep time has passed"
            checked={settings.app_blocking !== false}
            onChange={(v) => persistSettings({ app_blocking: v })}
          />
        </Section>

        <Section title="Account">
          <div>
            <Label className="text-xs">Display name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => fullName && persistProfile({ full_name: fullName })}
            />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={email} readOnly className="text-muted-foreground" />
          </div>
          <Button
            onClick={handleSignOut}
            variant="destructive"
            className="w-full"
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </Section>
      </div>
    </AppShell>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
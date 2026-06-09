import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../../components/app-shell";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/")({
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

function Index() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = Route.useRouteContext();
  const sleepGoal =
    (typeof localStorage !== "undefined" && localStorage.getItem("sleep_goal_time")) || "22:00";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Still up?";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <AppShell
      subtitle={`${greeting}${user.email ? ` · ${user.email.split("@")[0]}` : ""}`}
      title="SleepIO"
      action={
        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
        </button>
      }
    >
      <div className="space-y-4">
        <PlaceholderCard
          eyebrow="Tonight"
          title={`Wind down at ${formatTime(sleepGoal)}`}
          body="Your personalized sleep plan will appear here once Phase 6 ships."
        />
        <PlaceholderCard
          eyebrow="Today"
          title="3 study blocks queued"
          body="The schedule generator lands in Phase 5 — this card will preview the day."
        />
        <PlaceholderCard
          eyebrow="Your stats"
          title="Sleep & focus trends"
          body="Weekly progress moves into Home in Phase 10. Tap to open the stats deep-dive."
        />
      </div>
    </AppShell>
  );
}

function formatTime(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  let h = Number(hStr);
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

function PlaceholderCard({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_1px_0_0_var(--border)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

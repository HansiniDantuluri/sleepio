import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../../components/app-shell";

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
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Still up?";
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <AppShell subtitle={greeting} title="SleepIO">
      <div className="space-y-4">
        <PlaceholderCard
          eyebrow="Tonight"
          title="Wind down at 10:30 PM"
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

function PlaceholderCard({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_1px_0_0_var(--border)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{eyebrow}</p>
      <h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

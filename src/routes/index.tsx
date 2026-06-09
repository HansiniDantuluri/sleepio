import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "../components/app-shell";

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

function Index() {
  const [greeting, setGreeting] = useState<string | undefined>(undefined);
  useEffect(() => {
    const h = new Date().getHours();
    if (h < 5) setGreeting("Still up?");
    else if (h < 12) setGreeting("Good morning");
    else if (h < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  return (
    <AppShell subtitle={greeting} title="SleepIO">
      <div className="space-y-4">
        <Link
          to="/onboarding"
          className="block rounded-3xl border border-primary/30 bg-primary/10 p-5 text-foreground transition hover:border-primary/60"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Get started</p>
          <h2 className="mt-2 text-lg font-semibold">Set up your plan</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            5 quick questions about sleep, school, and study so we can personalize SleepIO.
          </p>
        </Link>
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

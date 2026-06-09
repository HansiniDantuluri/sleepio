import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import { StubPanel } from "../components/stub-panel";

export const Route = createFileRoute("/_authenticated/stats")({
  head: () => ({
    meta: [
      { title: "Your Stats — SleepIO" },
      { name: "description", content: "Weekly sleep, study, and focus analytics." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  return (
    <AppShell subtitle="Last 7 days" title="Your Stats">
      <StubPanel
        phase="Phase 10"
        title="Weekly chart & AI insights"
        body="Recharts weekly sleep chart, log table, and AI-narrated suggestions land in Phase 10."
      />
    </AppShell>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import { StubPanel } from "../components/stub-panel";

export const Route = createFileRoute("/sleep")({
  head: () => ({
    meta: [
      { title: "Sleep — SleepIO" },
      { name: "description", content: "Track your sleep and wind down with personalized stories." },
    ],
  }),
  component: SleepPage,
});

function SleepPage() {
  return (
    <AppShell subtitle="Tonight" title="Sleep">
      <StubPanel
        phase="Phase 6 & 9"
        title="Sleep tracker & wind-down stories"
        body="Sleep sessions, mood check-in, quality scoring, and ElevenLabs bedtime stories arrive in Phases 6 and 9."
      />
    </AppShell>
  );
}
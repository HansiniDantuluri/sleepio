import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import { StubPanel } from "../components/stub-panel";

export const Route = createFileRoute("/_authenticated/focus")({
  head: () => ({
    meta: [
      { title: "Focus — SleepIO" },
      { name: "description", content: "Pomodoro focus timer with ambient music." },
    ],
  }),
  component: FocusPage,
});

function FocusPage() {
  return (
    <AppShell subtitle="Deep work" title="Focus">
      <StubPanel
        phase="Phase 8 & 9"
        title="Pomodoro + music player"
        body="Focus timer, app-blocking toggle, and the 10-track ambient music player ship in Phases 8 and 9."
      />
    </AppShell>
  );
}
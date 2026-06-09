import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../../components/app-shell";
import { StubPanel } from "../../components/stub-panel";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Plan — SleepIO" },
      { name: "description", content: "Your day, planned around sleep and study." },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  return (
    <AppShell subtitle="Today" title="Plan">
      <StubPanel
        phase="Phase 5"
        title="AI schedule generator"
        body="Drag-and-drop study plan, exam-aware blocks, and per-day timeline arrive in Phase 5."
      />
    </AppShell>
  );
}
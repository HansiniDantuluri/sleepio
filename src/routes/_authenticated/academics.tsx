import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import { StubPanel } from "../components/stub-panel";

export const Route = createFileRoute("/_authenticated/academics")({
  head: () => ({
    meta: [
      { title: "Academics — SleepIO" },
      { name: "description", content: "Subjects, exams, and IB/IGCSE study materials." },
    ],
  }),
  component: AcademicsPage,
});

function AcademicsPage() {
  return (
    <AppShell subtitle="IB & IGCSE" title="Academics">
      <StubPanel
        phase="Phase 4"
        title="Subjects & exam timeline"
        body="Subjects, predicted grades, exam dates, and the syllabus library land in Phase 4."
      />
    </AppShell>
  );
}
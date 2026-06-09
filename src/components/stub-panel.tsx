export function StubPanel({ phase, title, body }: { phase: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-surface p-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">{phase}</p>
      <h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
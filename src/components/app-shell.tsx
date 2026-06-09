import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
        <header className="flex items-end justify-between gap-4 px-5 pb-2 pt-8">
          <div>
            {subtitle && (
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {subtitle}
              </p>
            )}
            {title && (
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            )}
          </div>
          {action ?? <ThemeToggle />}
        </header>
        <main className="flex-1 px-5 pb-28 pt-4">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, GraduationCap, Timer, Moon } from "lucide-react";
import { motion } from "framer-motion";

const TABS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/plan", label: "Plan", icon: CalendarDays },
  { to: "/academics", label: "Academics", icon: GraduationCap },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/sleep", label: "Sleep", icon: Moon },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-between px-2">
        {TABS.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className="relative flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-medium tracking-wide"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-colors ${
                    active ? "text-brand-foreground" : "text-muted-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-x-3 top-1 h-9 rounded-2xl bg-brand shadow-[0_8px_24px_-8px_var(--brand)]"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 h-[18px] w-[18px]" strokeWidth={2.25} />
                </span>
                <span className={`relative z-10 ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
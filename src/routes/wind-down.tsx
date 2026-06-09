import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Music, Wind, BookOpen } from "lucide-react";

import { useTheme } from "../components/theme-provider";

export const Route = createFileRoute("/wind-down")({
  head: () => ({
    meta: [
      { title: "Wind Down — SleepIO" },
      { name: "description", content: "Music, breathing, and bedtime stories for sleep." },
    ],
  }),
  component: WindDownHub,
});

type Mode = { id: "music" | "breathing" | "story"; title: string; desc: string; to: string; icon: typeof Music };

const MODES: Mode[] = [
  { id: "music", title: "Music", desc: "10 calming tracks", to: "/wind-down/music", icon: Music },
  { id: "breathing", title: "Breathing", desc: "4-7-8 method", to: "/wind-down/breathing", icon: Wind },
  { id: "story", title: "Story", desc: "AI bedtime stories", to: "/wind-down/story", icon: BookOpen },
];

function WindDownHub() {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const [selected, setSelected] = useState<Mode["id"] | null>(null);

  useEffect(() => {
    setMode("sleep");
  }, [setMode]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.14_0.05_270)] to-[oklch(0.08_0.04_270)] text-white">
      {/* Floating blobs */}
      <motion.div
        className="pointer-events-none absolute -left-20 top-20 h-64 w-64 rounded-full bg-purple-500/20 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-16 bottom-32 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl"
        animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-xl font-semibold">Wind Down</h1>
        <div className="h-10 w-10" />
      </header>

      <main className="relative mx-auto max-w-xl px-5 pt-10">
        <p className="text-center text-sm text-white/70">Choose how you'd like to ease into rest.</p>
        <div className="mt-8 space-y-4">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = selected === m.id;
            return (
              <motion.button
                key={m.id}
                type="button"
                whileTap={{ scale: 0.98 }}
                onMouseEnter={() => setSelected(m.id)}
                onFocus={() => setSelected(m.id)}
                onClick={() => {
                  setSelected(m.id);
                  setTimeout(() => navigate({ to: m.to }), 180);
                }}
                animate={
                  active
                    ? { boxShadow: "0 0 36px 6px oklch(0.65 0.18 280 / 0.45)", scale: 1.02 }
                    : { boxShadow: "0 0 0 0 transparent", scale: 1 }
                }
                transition={{ duration: 0.3 }}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left backdrop-blur"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="flex-1">
                  <span className="block font-display text-lg font-semibold">{m.title}</span>
                  <span className="block text-xs text-white/65">{m.desc}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
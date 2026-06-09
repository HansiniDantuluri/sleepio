import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { useTheme } from "../components/theme-provider";
import { TRACKS } from "../data/tracks";

export const Route = createFileRoute("/wind-down_/music")({
  head: () => ({ meta: [{ title: "Music — Wind Down" }] }),
  component: MusicPlayer,
});

function fmt(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MusicPlayer() {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setMode("sleep"); }, [setMode]);

  const track = TRACKS[i];

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = track.url;
    setCurrent(0);
    setDuration(0);
    if (playing) a.play().catch(() => setPlaying(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [playing]);

  const next = () => setI((p) => (p + 1) % TRACKS.length);
  const prev = () => setI((p) => (p - 1 + TRACKS.length) % TRACKS.length);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.13_0.05_270)] to-[oklch(0.07_0.04_270)] text-white">
      <Stars />
      <motion.div
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, -25, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />

      <header className="relative mx-auto flex max-w-xl items-center justify-between px-5 pt-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/wind-down" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-semibold">Music</h1>
        <div className="h-10 w-10" />
      </header>

      <main className="relative mx-auto flex max-w-xl flex-col items-center px-6 pt-10 pb-10">
        {/* Vinyl */}
        <motion.div
          animate={{ rotate: playing ? 360 : 0 }}
          transition={{ duration: 14, repeat: playing ? Infinity : 0, ease: "linear" }}
          className="relative flex h-64 w-64 items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 to-black shadow-2xl"
        >
          <div className="absolute inset-4 rounded-full border border-white/5" />
          <div className="absolute inset-10 rounded-full border border-white/5" />
          <div className="absolute inset-16 rounded-full border border-white/5" />
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-2xl font-bold">
            ♪
          </div>
        </motion.div>

        <div className="mt-8 text-center">
          <p className="font-display text-xl font-semibold">{track.title}</p>
          <p className="mt-1 text-sm text-white/65">{track.artist}</p>
        </div>

        {/* Progress */}
        <div className="mt-6 w-full max-w-sm">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={current}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = v;
              setCurrent(v);
            }}
            className="w-full accent-purple-400"
          />
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/55">
            <span>{fmt(current)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex items-center gap-8">
          <button type="button" onClick={prev} aria-label="Previous" className="text-white/85 hover:text-white">
            <SkipBack className="h-7 w-7" />
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setPlaying((p) => !p)}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[oklch(0.18_0.05_270)] shadow-xl"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="h-7 w-7 fill-current" />}
          </motion.button>
          <button type="button" onClick={next} aria-label="Next" className="text-white/85 hover:text-white">
            <SkipForward className="h-7 w-7" />
          </button>
        </div>

        <audio
          ref={audioRef}
          onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onEnded={next}
          preload="metadata"
        />
      </main>
    </div>
  );
}

function Stars() {
  const [stars, setStars] = useState<Array<{ top: number; left: number; size: number; opacity: number }>>([]);
  useEffect(() => {
    const arr = Array.from({ length: 35 }).map(() => ({
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.6 + 0.2,
    }));
    setStars(arr);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, opacity: s.opacity }}
        />
      ))}
    </div>
  );
}
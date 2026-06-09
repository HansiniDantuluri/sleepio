import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Pause, Play, Sparkles } from "lucide-react";

import { useTheme } from "../components/theme-provider";
import { checkStoryAvailable, generateBedtimeStory } from "../lib/api/story.functions";

export const Route = createFileRoute("/wind-down_/story")({
  head: () => ({ meta: [{ title: "Bedtime Story — Wind Down" }] }),
  component: StoryPage,
});

function fmt(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function StoryPage() {
  const navigate = useNavigate();
  const { setMode } = useTheme();
  const check = useServerFn(checkStoryAvailable);
  const generate = useServerFn(generateBedtimeStory);

  const [checking, setChecking] = useState(true);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storyText, setStoryText] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { setMode("sleep"); }, [setMode]);

  useEffect(() => {
    (async () => {
      try {
        const r = await check();
        setTtsAvailable(Boolean(r.elevenlabs));
      } catch {
        setTtsAvailable(false);
      } finally {
        setChecking(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onGenerate = async () => {
    setLoading(true);
    setStoryText(null);
    setAudioUrl(null);
    setAudioNote(null);
    setPlaying(false);
    try {
      const r = await generate();
      setStoryText(r.text);
      if (r.audioBase64) {
        setAudioUrl(`data:audio/mpeg;base64,${r.audioBase64}`);
      } else {
        setAudioNote("Audio unavailable — read along instead");
      }
    } catch (e) {
      setAudioNote((e as Error).message || "Couldn't generate story");
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  };

  if (!checking && !ttsAvailable && !storyText) {
    // Gracefully degrade rather than crash; still allow text generation
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-[oklch(0.18_0.05_270)] via-[oklch(0.12_0.05_270)] to-[oklch(0.06_0.04_270)] text-white">
      <header className="mx-auto flex max-w-xl items-center justify-between px-5 pt-6">
        <button
          type="button"
          onClick={() => navigate({ to: "/wind-down" })}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-semibold">Bedtime Story</h1>
        <div className="h-10 w-10" />
      </header>

      <main className="relative mx-auto max-w-xl px-6 pt-8 pb-10">
        {checking ? (
          <p className="text-center text-sm text-white/65">Loading…</p>
        ) : !ttsAvailable && !storyText ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            Voice narration is not configured. Please contact support.
          </div>
        ) : null}

        {!loading && !storyText && (
          <div className="mt-6 flex flex-col items-center text-center">
            <p className="text-sm text-white/70">A calming story, written just for tonight.</p>
            <button
              type="button"
              onClick={onGenerate}
              disabled={!ttsAvailable && false}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[oklch(0.18_0.05_270)]"
            >
              <Sparkles className="h-4 w-4" /> Generate Story
            </button>
          </div>
        )}

        {loading && (
          <div className="mt-10 flex flex-col items-center">
            <motion.div
              animate={{ rotate: 360, y: [0, -8, 0] }}
              transition={{ rotate: { duration: 18, repeat: Infinity, ease: "linear" }, y: { duration: 3, repeat: Infinity, ease: "easeInOut" } }}
              className="text-6xl"
            >
              🌙
            </motion.div>
            <p className="mt-6 text-sm text-white/75">Crafting your story…</p>
          </div>
        )}

        {storyText && (
          <div className="mt-6 space-y-4">
            {audioUrl ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-4">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={togglePlay}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[oklch(0.18_0.05_270)]"
                    aria-label={playing ? "Pause" : "Play"}
                  >
                    {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
                  </motion.button>
                  <div className="flex-1">
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
                    <div className="flex justify-between text-[11px] tabular-nums text-white/55">
                      <span>{fmt(current)}</span>
                      <span>{fmt(duration)}</span>
                    </div>
                  </div>
                </div>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                  onEnded={() => setPlaying(false)}
                  preload="metadata"
                />
              </div>
            ) : (
              audioNote && (
                <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  {audioNote}
                </div>
              )
            )}

            <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/85 whitespace-pre-wrap">
              {storyText}
            </div>

            <button
              type="button"
              onClick={onGenerate}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-white/85"
            >
              <Sparkles className="h-3.5 w-3.5" /> New story
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
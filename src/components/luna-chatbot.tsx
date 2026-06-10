import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";

import { chatWithLuna, getLunaContext, type LunaContext } from "../lib/api/luna.functions";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
};

const SUGGESTED = [
  "How can I sleep better tonight?",
  "Help me plan tomorrow",
  "I'm stressed about my exams 😰",
  "Best way to revise my subject?",
  "Why do I keep waking up tired?",
];

const HIDDEN_ROUTES = ["/sleep", "/focus"];

function fmtTime(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function buildGreeting(ctx: LunaContext): string {
  const name = ctx.name || "there";
  if (ctx.lastSleepMinutes != null && ctx.lastSleepMinutes < ctx.sleepTargetMinutes * 0.75) {
    const h = Math.floor(ctx.lastSleepMinutes / 60);
    const m = ctx.lastSleepMinutes % 60;
    return `Hey ${name}! You only got ${h}h ${m}m last night — your brain needs more to perform at its best. Want some tips for tonight? 💙`;
  }
  const soonIA = ctx.upcomingIAs.find((ia) => ia.daysAway <= 3);
  if (soonIA) {
    return `Hey ${name}! Your ${soonIA.subject} IA is due in ${soonIA.daysAway} day${soonIA.daysAway === 1 ? "" : "s"}. Feeling on top of it or need help planning? 📝`;
  }
  return `Hey ${name}! You're looking on track today. What can I help you with? ✨`;
}

export function LunaChatbot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hidden = HIDDEN_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [errored, setErrored] = useState(false);
  const [ctx, setCtx] = useState<LunaContext | null>(null);
  const fetchCtx = useServerFn(getLunaContext);
  const sendChat = useServerFn(chatWithLuna);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialisedRef = useRef(false);

  // Sleep mode = evening/night
  const hour = new Date().getHours();
  const sleepMode = hour >= 19 || hour < 6;

  // Fetch context + seed greeting first time drawer opens
  useEffect(() => {
    if (!open || initialisedRef.current) return;
    initialisedRef.current = true;
    let cancelled = false;
    fetchCtx()
      .then((c) => {
        if (cancelled) return;
        setCtx(c);
        setMessages([
          {
            id: "greet",
            role: "assistant",
            content: buildGreeting(c),
            ts: Date.now(),
          },
        ]);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([
          {
            id: "greet",
            role: "assistant",
            content: "Hey! I'm Luna, your sleep & study coach. What can I help you with? ✨",
            ts: Date.now(),
          },
        ]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fetchCtx]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending, open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      setErrored(false);
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: trimmed,
        ts: Date.now(),
      };
      const nextMsgs = [...messages, userMsg];
      setMessages(nextMsgs);
      setInput("");
      setPending(true);
      try {
        const history = nextMsgs
          .filter((m) => m.id !== "greet")
          .map((m) => ({ role: m.role, content: m.content }));
        const safeCtx = ctx ?? {
          name: "",
          curriculum: "IB",
          subjects: [],
          sleepGoalTime: null,
          sleepTargetMinutes: 480,
          lastSleepMinutes: null,
          upcomingIAs: [],
          todayTaskCount: 0,
        };
        const { reply } = await sendChat({
          data: {
            messages: history,
            context: {
              name: safeCtx.name,
              curriculum: safeCtx.curriculum,
              subjects: safeCtx.subjects,
              sleepGoalTime: safeCtx.sleepGoalTime,
              sleepTargetMinutes: safeCtx.sleepTargetMinutes,
              lastSleepMinutes: safeCtx.lastSleepMinutes,
              upcomingIAs: safeCtx.upcomingIAs.map((ia) => ({
                subject: ia.subject,
                title: ia.title,
                due_date: ia.due_date,
                daysAway: ia.daysAway,
              })),
            },
          },
        });
        setMessages((m) => [
          ...m,
          { id: `a-${Date.now()}`, role: "assistant", content: reply, ts: Date.now() },
        ]);
      } catch {
        setErrored(true);
      } finally {
        setPending(false);
      }
    },
    [messages, pending, sendChat, ctx],
  );

  const showChips = useMemo(() => messages.length === 1, [messages.length]);

  if (hidden) return null;

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.04 }}
        aria-label="Open Luna chat"
        className="fixed z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg"
        style={{
          right: 20,
          bottom: 80,
          backgroundColor: sleepMode ? "#7C3AED" : "#4A90E2",
          boxShadow: sleepMode
            ? "0 8px 24px rgba(124,58,237,0.45)"
            : "0 8px 24px rgba(74,144,226,0.4)",
        }}
      >
        {sleepMode && (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{ border: "2px solid rgba(167,139,250,0.55)" }}
            animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <MessageCircle className="h-6 w-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="luna-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              key="luna-drawer"
              role="dialog"
              aria-label="Luna chat"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col"
              style={{
                height: "72dvh",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                background: "linear-gradient(180deg, #0D0D2B 0%, #1A0A3D 100%)",
                color: "white",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: "linear-gradient(135deg,#7C3AED,#a78bfa)",
                      boxShadow: "0 0 18px rgba(167,139,250,0.55)",
                    }}
                  >
                    L
                  </div>
                  <div>
                    <h2
                      className="font-display text-xl font-semibold"
                      style={{
                        background: "linear-gradient(90deg,#ffffff,#c4b5fd)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      Luna
                    </h2>
                    <p className="text-xs text-white/60">Your sleep & study coach</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close Luna"
                  className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mx-5 h-px bg-white/10" />

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                <AnimatePresence initial={false}>
                  {messages.map((m) => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`flex max-w-[85%] items-end gap-2 ${
                          m.role === "user" ? "flex-row-reverse" : ""
                        }`}
                      >
                        {m.role === "assistant" && (
                          <div
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                            style={{
                              background: "linear-gradient(135deg,#7C3AED,#a78bfa)",
                              boxShadow: "0 0 8px rgba(167,139,250,0.5)",
                            }}
                          >
                            L
                          </div>
                        )}
                        <div
                          className="whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                          style={
                            m.role === "user"
                              ? { background: "#4A90E2", color: "white" }
                              : {
                                  background: "rgba(124,58,237,0.22)",
                                  color: "rgba(255,255,255,0.95)",
                                  border: "1px solid rgba(167,139,250,0.18)",
                                }
                          }
                        >
                          {m.content}
                        </div>
                      </div>
                      <span
                        className={`mt-1 text-[10px] text-white/40 ${
                          m.role === "user" ? "mr-1" : "ml-8"
                        }`}
                      >
                        {fmtTime(m.ts)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {showChips && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="-mx-5 flex gap-2 overflow-x-auto px-5 pt-1"
                  >
                    {SUGGESTED.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void send(s)}
                        className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/10"
                      >
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}

                {pending && (
                  <div className="flex items-end gap-2">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ background: "linear-gradient(135deg,#7C3AED,#a78bfa)" }}
                    >
                      L
                    </div>
                    <div
                      className="flex items-center gap-1 rounded-2xl px-4 py-3"
                      style={{
                        background: "rgba(124,58,237,0.22)",
                        border: "1px solid rgba(167,139,250,0.18)",
                      }}
                    >
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-white/80"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{
                            duration: 0.9,
                            repeat: Infinity,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {errored && (
                  <div className="flex flex-col items-start gap-2">
                    <div
                      className="rounded-2xl px-4 py-2.5 text-sm"
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid rgba(239,68,68,0.35)",
                        color: "rgba(255,255,255,0.95)",
                      }}
                    >
                      Luna is unavailable right now. Try again in a moment.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const last = [...messages].reverse().find((m) => m.role === "user");
                        if (!last) return;
                        setMessages((ms) => ms.filter((m) => m.id !== last.id));
                        void send(last.content);
                      }}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/90 hover:bg-white/15"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className="px-4 pb-4 pt-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Luna anything..."
                    disabled={pending}
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none disabled:opacity-60"
                  />
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    type="submit"
                    disabled={!input.trim() || pending}
                    aria-label="Send"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:opacity-40"
                    style={{ background: "#4A90E2" }}
                  >
                    <Send className="h-4 w-4" />
                  </motion.button>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Brain, Layers, Pencil, Loader2, Trash2, Plus, Eraser, Download, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  checkFeynman,
  reviewBlurt,
  listDecks,
  createDeck,
  deleteDeck,
  listCards,
  createCard,
  deleteCard,
  rateCard,
} from "../lib/api/study-tools.functions";

const DEFAULT_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "Economics", "ESS", "Business", "English"];

export function StudyTools() {
  return (
    <Tabs defaultValue="feynman" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="feynman"><Lightbulb className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="blurt"><Brain className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="cards"><Layers className="h-4 w-4" /></TabsTrigger>
        <TabsTrigger value="board"><Pencil className="h-4 w-4" /></TabsTrigger>
      </TabsList>
      <TabsContent value="feynman" className="mt-4"><Feynman /></TabsContent>
      <TabsContent value="blurt" className="mt-4"><Blurting /></TabsContent>
      <TabsContent value="cards" className="mt-4"><Flashcards /></TabsContent>
      <TabsContent value="board" className="mt-4"><Whiteboard /></TabsContent>
    </Tabs>
  );
}

/* --------------- Feynman --------------- */
function Feynman() {
  const check = useServerFn(checkFeynman);
  const [subject, setSubject] = useState(DEFAULT_SUBJECTS[0]);
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onCheck = async () => {
    if (text.trim().length < 20) { toast.error("Write at least a couple sentences first."); return; }
    setLoading(true); setFeedback(null);
    try {
      const r = await check({ data: { subject, explanation: text } });
      setFeedback(r.feedback);
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
        <p className="text-sm">Pick a concept you just studied. Now explain it out loud like you're teaching a Year 7 student.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DEFAULT_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Textarea rows={6} placeholder="Explain it simply…" value={text} onChange={(e) => setText(e.target.value)} />
      <Button onClick={onCheck} disabled={loading} className="w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check Understanding"}
      </Button>
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Coach</p>
            <p className="mt-1 text-sm leading-relaxed">{feedback}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* --------------- Blurting --------------- */
function Blurting() {
  const review = useServerFn(reviewBlurt);
  const [phase, setPhase] = useState<"setup" | "study" | "blurt" | "done">("setup");
  const [subject, setSubject] = useState(DEFAULT_SUBJECTS[0]);
  const [remaining, setRemaining] = useState(20 * 60);
  const [blurt, setBlurt] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (phase !== "study") return;
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { window.clearInterval(id); setPhase("blurt"); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const submit = async () => {
    if (blurt.trim().length < 20) { toast.error("Write more before submitting."); return; }
    setLoading(true);
    try {
      const r = await review({ data: { subject, blurt_text: blurt, save: true } });
      setFeedback(r.feedback); setPhase("done");
    } catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  };

  if (phase === "setup") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md text-sm">
          Study a topic for 20 min, then close everything and write EVERYTHING you remember.
        </div>
        <Label className="text-xs">Subject</Label>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{DEFAULT_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="w-full" onClick={() => { setRemaining(20 * 60); setPhase("study"); }}>Start 20 min study timer</Button>
        <Button variant="outline" className="w-full" onClick={() => setPhase("blurt")}>Skip to brain dump</Button>
      </motion.div>
    );
  }

  if (phase === "study") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Study now — no notes after timer</p>
        <p className="font-display text-6xl font-semibold tabular-nums">{mm}:{ss}</p>
        <Button variant="outline" onClick={() => setPhase("blurt")}>I'm ready early</Button>
      </div>
    );
  }

  if (phase === "blurt") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        <h3 className="font-display text-xl font-semibold">Brain Dump — write everything you remember</h3>
        <Textarea rows={14} autoFocus value={blurt} onChange={(e) => setBlurt(e.target.value)} />
        <Button className="w-full" onClick={submit} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "I'm done"}
        </Button>
      </motion.div>
    );
  }

  const wc = blurt.trim().split(/\s+/).filter(Boolean).length;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 text-center backdrop-blur-md">
        <motion.div initial={{ scale: 0 }} animate={{ scale: [0, 1.2, 1] }} className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <Check className="h-6 w-6" />
        </motion.div>
        <p className="font-display text-lg font-semibold">{wc} words</p>
        <p className="text-xs text-muted-foreground">Compare your dump with your notes — that gap is your study list.</p>
      </div>
      {feedback && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Coach</p>
          <p className="mt-1 text-sm leading-relaxed">{feedback}</p>
        </div>
      )}
      <Button variant="outline" className="w-full" onClick={() => { setPhase("setup"); setBlurt(""); setFeedback(null); }}>New session</Button>
    </motion.div>
  );
}

/* --------------- Flashcards --------------- */
type Deck = { id: string; subject: string; name: string; card_count: number };
type Card = { id: string; front: string; back: string; ease_factor: number; next_review: string };

function Flashcards() {
  const listD = useServerFn(listDecks);
  const createD = useServerFn(createDeck);
  const delD = useServerFn(deleteDeck);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [active, setActive] = useState<Deck | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ subject: DEFAULT_SUBJECTS[0], name: "" });

  const reload = async () => {
    try { const r = await listD(); setDecks((r.decks as Deck[]) ?? []); } catch { /* */ }
  };
  useEffect(() => { void reload(); }, []);

  if (active) return <DeckStudy deck={active} onClose={() => { setActive(null); void reload(); }} />;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{decks.length} deck{decks.length === 1 ? "" : "s"}</p>
        <Button size="sm" onClick={() => setAdding((v) => !v)}><Plus className="mr-1 h-4 w-4" /> New deck</Button>
      </div>
      {adding && (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
          <Select value={form.subject} onValueChange={(v) => setForm({ ...form, subject: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DEFAULT_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Deck name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Button
            size="sm"
            onClick={async () => {
              if (!form.name) return toast.error("Name required");
              try { await createD({ data: form }); setAdding(false); setForm({ subject: DEFAULT_SUBJECTS[0], name: "" }); void reload(); }
              catch (e) { toast.error((e as Error).message); }
            }}
          >Create</Button>
        </div>
      )}
      {decks.length === 0 && !adding && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No decks yet. Create one to start studying.
        </div>
      )}
      <div className="space-y-2">
        {decks.map((d) => (
          <motion.div
            key={d.id}
            whileHover={{ y: -2 }}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md"
          >
            <button type="button" className="flex-1 text-left" onClick={() => setActive(d)}>
              <p className="text-sm font-semibold">{d.name}</p>
              <p className="text-xs text-muted-foreground">{d.subject} · {d.card_count} card{d.card_count === 1 ? "" : "s"}</p>
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted"
              onClick={async () => { try { await delD({ data: { id: d.id } }); void reload(); } catch (e) { toast.error((e as Error).message); } }}
              aria-label="Delete deck"
            ><Trash2 className="h-4 w-4" /></button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function DeckStudy({ deck, onClose }: { deck: Deck; onClose: () => void }) {
  const listC = useServerFn(listCards);
  const createC = useServerFn(createCard);
  const delC = useServerFn(deleteCard);
  const rate = useServerFn(rateCard);
  const [cards, setCards] = useState<Card[]>([]);
  const [mode, setMode] = useState<"edit" | "study" | "done">("edit");
  const [queue, setQueue] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState(0);
  const [mastered, setMastered] = useState(0);
  const [missed, setMissed] = useState<Card[]>([]);
  const [form, setForm] = useState({ front: "", back: "" });

  const reload = async () => {
    try { const r = await listC({ data: { deck_id: deck.id } }); setCards((r.cards as Card[]) ?? []); } catch { /* */ }
  };
  useEffect(() => { void reload(); }, []);

  const startStudy = () => {
    if (cards.length === 0) return toast.error("Add at least one card");
    setQueue([...cards]);
    setIdx(0); setFlipped(false); setScore(0); setMastered(0); setMissed([]);
    setMode("study");
  };

  const onRate = async (rating: "got" | "almost" | "missed") => {
    const card = queue[idx];
    if (!card) return;
    try { await rate({ data: { id: card.id, rating } }); } catch { /* */ }
    let nextScore = score;
    if (rating === "got") { nextScore += 3; setMastered((m) => m + 1); }
    else if (rating === "almost") nextScore += 1;
    let nextQueue = queue;
    if (rating === "missed") { nextQueue = [...queue, card]; setMissed((m) => [...m, card]); }
    setScore(nextScore); setQueue(nextQueue);
    if (idx + 1 >= nextQueue.length) { setMode("done"); return; }
    setIdx(idx + 1); setFlipped(false);
  };

  if (mode === "study") {
    const card = queue[idx];
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs">
          <button type="button" onClick={() => setMode("edit")} className="text-muted-foreground">← Exit</button>
          <span>Score: <b>{score}</b> · Card {idx + 1}/{queue.length}</span>
        </div>
        <motion.div
          key={card?.id + (flipped ? "b" : "f")}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          className="flex min-h-[200px] cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] p-6 text-center backdrop-blur-md"
          onClick={() => setFlipped((v) => !v)}
        >
          <p className="text-lg">{flipped ? card?.back : card?.front}</p>
        </motion.div>
        {flipped && (
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={() => onRate("missed")} variant="outline" className="border-red-500/40 text-red-400">❌ Missed</Button>
            <Button onClick={() => onRate("almost")} variant="outline" className="border-amber-500/40 text-amber-400">🟡 Almost</Button>
            <Button onClick={() => onRate("got")} variant="outline" className="border-emerald-500/40 text-emerald-400">✅ Got it</Button>
          </div>
        )}
        {!flipped && (
          <Button className="w-full" onClick={() => setFlipped(true)}>Reveal answer</Button>
        )}
      </div>
    );
  }

  if (mode === "done") {
    return (
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-4 text-center">
        <p className="text-5xl">🏆</p>
        <h3 className="font-display text-2xl font-semibold">Session complete</h3>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Score" value={score} />
          <Stat label="Mastered" value={mastered} />
          <Stat label="To review" value={missed.length} />
        </div>
        <Button className="w-full" onClick={() => setMode("edit")}>Back to deck</Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onClose} className="text-xs text-muted-foreground">← All decks</button>
        <Button size="sm" onClick={startStudy} disabled={cards.length === 0}>Study deck</Button>
      </div>
      <h3 className="font-display text-lg font-semibold">{deck.name}</h3>
      <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
        <Input placeholder="Front (question)" value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} />
        <Input placeholder="Back (answer)" value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} />
        <Button
          size="sm"
          onClick={async () => {
            if (!form.front || !form.back) return toast.error("Both sides required");
            try { await createC({ data: { deck_id: deck.id, ...form } }); setForm({ front: "", back: "" }); void reload(); }
            catch (e) { toast.error((e as Error).message); }
          }}
        ><Plus className="mr-1 h-4 w-4" /> Add card</Button>
      </div>
      <div className="space-y-1">
        {cards.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-xs">
            <span className="truncate"><b>{c.front}</b> — {c.back}</span>
            <button
              type="button"
              onClick={async () => { try { await delC({ data: { id: c.id } }); void reload(); } catch (e) { toast.error((e as Error).message); } }}
              className="ml-2 text-muted-foreground"
              aria-label="Delete"
            ><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-md">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

/* --------------- Whiteboard --------------- */
const PROMPTS: Record<string, string[]> = {
  Economics: ["Try drawing the AD-AS diagram"],
  ESS: ["Draw a systems diagram with feedback loops"],
  Business: ["Sketch an organizational structure"],
  Mathematics: ["Visualize the chain rule"],
  Biology: ["Draw and label a cell"],
};
const COLORS = ["#0f172a", "#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];

function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(3);
  const [erasing, setErasing] = useState(false);
  const [subject, setSubject] = useState<keyof typeof PROMPTS>("Biology");
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.clientWidth, c.clientHeight);
  }, []);

  const getPos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.PointerEvent) => {
    drawing.current = true; last.current = getPos(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d"); if (!ctx) return;
    const p = getPos(e);
    ctx.strokeStyle = erasing ? "#ffffff" : color;
    ctx.lineWidth = erasing ? 20 : width;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const onUp = () => { drawing.current = false; };

  const clearAll = () => {
    const c = canvasRef.current!; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
  };
  const savePng = () => {
    const c = canvasRef.current!; const url = c.toDataURL("image/png");
    const a = document.createElement("a"); a.href = url; a.download = "whiteboard.png"; a.click();
  };

  const prompt = PROMPTS[subject]?.[0];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Select value={subject as string} onValueChange={(v) => setSubject(v as keyof typeof PROMPTS)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.keys(PROMPTS).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <p className="flex-1 truncate text-xs text-muted-foreground">💡 {prompt}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c} type="button" onClick={() => { setColor(c); setErasing(false); }}
            className={"h-7 w-7 rounded-full border-2 " + (color === c && !erasing ? "border-foreground" : "border-transparent")}
            style={{ background: c }} aria-label={`Color ${c}`}
          />
        ))}
        <select value={width} onChange={(e) => setWidth(Number(e.target.value))} className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <option value={2}>Thin</option><option value={4}>Medium</option><option value={8}>Thick</option>
        </select>
        <Button size="sm" variant={erasing ? "default" : "outline"} onClick={() => setErasing((v) => !v)}><Eraser className="h-3 w-3" /></Button>
        <Button size="sm" variant="outline" onClick={clearAll}>Clear</Button>
        <Button size="sm" variant="outline" onClick={savePng}><Download className="h-3 w-3" /></Button>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        className="h-[420px] w-full touch-none rounded-2xl border border-white/10 bg-white shadow-inner"
      />
    </motion.div>
  );
}
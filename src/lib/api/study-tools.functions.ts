import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---------------- Feynman / Blurt AI feedback ---------------- */

export const checkFeynman = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      subject: z.string().min(1).max(80),
      explanation: z.string().min(20).max(8000),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { feedback: "AI is offline — but explaining out loud already strengthens recall. Re-read your notes and look for one detail you skipped." };
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");
    const { text } = await generateText({
      model,
      system: "You are a kind IB/IGCSE study coach. Reply in 2-3 sentences. Be encouraging.",
      prompt: `A student explained this concept: "${data.explanation}". They are studying ${data.subject} for IB/IGCSE. Identify any gaps or misconceptions in 2-3 sentences. Be encouraging. Suggest one thing they missed if anything.`,
    });
    return { feedback: text.trim() };
  });

export const reviewBlurt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      subject: z.string().min(1).max(80),
      blurt_text: z.string().min(20).max(12000),
      save: z.boolean().default(true),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    let feedback = "Great brain dump! Compare what you wrote against your notes — anything missing is your study list for tomorrow.";
    if (key) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");
        const { text } = await generateText({
          model,
          system: "You are an encouraging study coach. 3-4 short sentences max.",
          prompt: `Student blurted this after studying ${data.subject}: "${data.blurt_text}". Give encouraging feedback, identify what they remembered well, and suggest 2 topics to review.`,
        });
        feedback = text.trim();
      } catch {/* fallback */}
    }
    if (data.save) {
      await supabase.from("study_notes").insert({
        user_id: userId,
        subject: data.subject,
        tool: "blurt",
        blurt_text: data.blurt_text,
        ai_feedback: feedback,
      });
    }
    return { feedback };
  });

export const listBlurts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("study_notes")
      .select("id, subject, blurt_text, ai_feedback, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { blurts: data ?? [] };
  });

/* ---------------- Flashcard decks ---------------- */

export const listDecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: decks, error } = await supabase
      .from("flashcard_decks")
      .select("id, subject, name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: counts } = await supabase
      .from("flashcards")
      .select("deck_id")
      .eq("user_id", userId);
    const countMap = new Map<string, number>();
    for (const r of counts ?? []) {
      countMap.set(r.deck_id as string, (countMap.get(r.deck_id as string) ?? 0) + 1);
    }
    return { decks: (decks ?? []).map((d) => ({ ...d, card_count: countMap.get(d.id) ?? 0 })) };
  });

export const createDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ subject: z.string().min(1).max(80), name: z.string().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("flashcard_decks")
      .insert({ ...data, user_id: userId })
      .select("id, subject, name, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteDeck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("flashcard_decks").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ deck_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cards, error } = await supabase
      .from("flashcards")
      .select("id, front, back, ease_factor, next_review")
      .eq("user_id", userId)
      .eq("deck_id", data.deck_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { cards: cards ?? [] };
  });

export const createCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      deck_id: z.string().uuid(),
      front: z.string().min(1).max(1000),
      back: z.string().min(1).max(4000),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("flashcards")
      .insert({ ...data, user_id: userId })
      .select("id, front, back, ease_factor, next_review")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("flashcards").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rateCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), rating: z.enum(["got", "almost", "missed"]) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: card } = await supabase
      .from("flashcards")
      .select("ease_factor")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    const ease = card?.ease_factor ?? 2.5;
    let nextEase = ease;
    let intervalDays = 1;
    if (data.rating === "got") { nextEase = Math.min(3.0, ease + 0.15); intervalDays = Math.round(ease * 3); }
    else if (data.rating === "almost") { nextEase = Math.max(1.3, ease - 0.05); intervalDays = 1; }
    else { nextEase = Math.max(1.3, ease - 0.25); intervalDays = 0; }
    const next_review = new Date(Date.now() + intervalDays * 86400000).toISOString();
    await supabase
      .from("flashcards")
      .update({ ease_factor: nextEase, next_review })
      .eq("id", data.id)
      .eq("user_id", userId);
    return { ok: true };
  });
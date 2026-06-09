import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startSleepSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ targetMinutes: z.number().int().min(60).max(900).optional() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // close any stale active sessions
    await supabase
      .from("sleep_sessions")
      .update({ status: "interrupted", end_time: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active");
    const { data: row, error } = await supabase
      .from("sleep_sessions")
      .insert({
        user_id: userId,
        start_time: new Date().toISOString(),
        status: "active",
        target_minutes: data.targetMinutes ?? 480,
      })
      .select("id, start_time, target_minutes")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const endSleepSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["complete", "interrupted"]) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("sleep_sessions")
      .update({ end_time: new Date().toISOString(), status: data.status })
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("id, start_time, end_time, status, target_minutes")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getActiveSleepSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sleep_sessions")
      .select("id, start_time, end_time, status, target_minutes")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { session: data };
  });

export const getLatestSleepSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("sleep_sessions")
      .select("id, start_time, end_time, status, target_minutes, mood_score, felt_enough, quality_score, narrative")
      .eq("user_id", userId)
      .not("end_time", "is", null)
      .order("end_time", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { session: data };
  });

export const saveSleepQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      mood_score: z.number().int().min(1).max(5).nullable().optional(),
      felt_enough: z.boolean().nullable().optional(),
      quality_score: z.number().min(0).max(5).nullable().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("sleep_sessions")
      .update({
        mood_score: data.mood_score ?? null,
        felt_enough: data.felt_enough ?? null,
        quality_score: data.quality_score ?? null,
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSleepNarrative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: session } = await supabase
      .from("sleep_sessions")
      .select("start_time, end_time, target_minutes, mood_score")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { narrative: null as string | null };
    const actualMin =
      session?.start_time && session?.end_time
        ? Math.max(
            0,
            Math.round(
              (new Date(session.end_time).getTime() -
                new Date(session.start_time).getTime()) /
                60000,
            ),
          )
        : 0;
    const target = session?.target_minutes ?? 480;
    const mood = session?.mood_score ?? 3;
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const model = gateway("google/gemini-3-flash-preview");
      const { text } = await generateText({
        model,
        system: "You are a warm sleep coach for a teenager. Never preachy.",
        prompt: `The student slept ${actualMin} minutes. Their target is ${target} minutes. Their mood on wake was ${mood}/5. Based on this, write exactly 3 short sentences: 1) A simple observation about their sleep using a relatable comparison (e.g. 'That's like missing an entire REM cycle'). 2) One specific science fact about what happens to the brain or body at this sleep level, explained simply for a teenager. 3) One actionable tip for tonight. Keep it warm, never preachy.`,
      });
      const narrative = text.trim();
      await supabase.from("sleep_sessions").update({ narrative }).eq("id", data.id).eq("user_id", userId);
      return { narrative };
    } catch {
      return { narrative: null as string | null };
    }
  });
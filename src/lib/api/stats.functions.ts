import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatsSession = {
  id: string;
  start_time: string;
  end_time: string | null;
  status: string;
  target_minutes: number | null;
  mood_score: number | null;
  quality_score: number | null;
};

export const getStatsData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [sessionsRes, focusRes, iaRes, planRes] = await Promise.all([
      supabase
        .from("sleep_sessions")
        .select("id, start_time, end_time, status, target_minutes, mood_score, quality_score")
        .eq("user_id", userId)
        .gte("start_time", since)
        .order("start_time", { ascending: false }),
      supabase
        .from("focus_sessions")
        .select("id, status, ended_at")
        .eq("user_id", userId),
      supabase
        .from("internal_assessments")
        .select("id, status, due_date")
        .eq("user_id", userId),
      supabase
        .from("study_plans")
        .select("id")
        .eq("user_id", userId)
        .limit(1),
    ]);

    const sessions = (sessionsRes.data ?? []) as StatsSession[];
    const focus = focusRes.data ?? [];
    const ias = iaRes.data ?? [];
    const plans = planRes.data ?? [];

    return {
      sessions,
      focusCompletedCount: focus.filter((f) => f.status === "complete").length,
      iaSubmittedCount: ias.filter((i) => i.status === "submitted" || i.status === "complete").length,
      hasStudyPlan: plans.length > 0,
    };
  });

export const generateStatsInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      payload: z.array(
        z.object({
          date: z.string(),
          actualMin: z.number(),
          targetMin: z.number(),
          quality: z.number().nullable(),
          mood: z.number().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key || data.payload.length === 0) return { insight: null as string | null };
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const model = gateway("google/gemini-3-flash-preview");
      const summary = data.payload
        .map(
          (d) =>
            `${d.date}: ${d.actualMin}/${d.targetMin}min, quality ${d.quality ?? "?"}/5, mood ${d.mood ?? "?"}/5`,
        )
        .join("\n");
      const { text } = await generateText({
        model,
        system: "You are a warm sleep coach for a teenager. Never preachy.",
        prompt: `Here is the last ${data.payload.length} days of sleep data:\n${summary}\n\nWrite exactly 3 short sentences: 1) one observation on the trend, 2) one actionable improvement tip for this week, 3) one specific positive reinforcement based on the data. Keep it warm and friendly.`,
      });
      return { insight: text.trim() };
    } catch {
      return { insight: null as string | null };
    }
  });
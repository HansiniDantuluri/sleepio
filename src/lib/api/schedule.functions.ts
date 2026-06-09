import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TaskSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(40),
  deadline: z.string().max(40).optional(),
  durationMin: z.number().int().min(15).max(240),
  priority: z.enum(["high", "medium", "low"]),
});

const BlockSchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  taskName: z.string(),
  type: z.string(),
  color: z.enum(["red", "yellow", "blue", "purple", "indigo", "gray"]).default("yellow"),
  isLocked: z.boolean().default(false),
  rationale: z.string().default(""),
});

const PrefsSchema = z.object({
  sleepGoalTime: z.string(),
  wakeTime: z.string(),
  energy: z.enum(["low", "medium", "high"]),
  intensity: z.number().int().min(1).max(5),
  date: z.string(),
});

function fallbackSchedule(tasks: z.infer<typeof TaskSchema>[], prefs: z.infer<typeof PrefsSchema>) {
  const [sh, sm] = prefs.sleepGoalTime.split(":").map(Number);
  const sleepStart = sh * 60 + sm;
  const windStart = sleepStart - 30;
  const now = new Date();
  let cursor = now.getHours() * 60 + now.getMinutes() + 5;
  const blocks: z.infer<typeof BlockSchema>[] = [];
  let sinceBreak = 0;
  const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  for (const t of tasks) {
    if (cursor + t.durationMin > windStart) break;
    if (sinceBreak >= 90) {
      blocks.push({ startTime: fmt(cursor), endTime: fmt(cursor + 10), taskName: "Short break", type: "break", color: "gray", isLocked: false, rationale: "Recover focus" });
      cursor += 10;
      sinceBreak = 0;
    }
    blocks.push({
      startTime: fmt(cursor),
      endTime: fmt(cursor + t.durationMin),
      taskName: t.name,
      type: t.type,
      color: t.priority === "high" ? "red" : t.priority === "medium" ? "yellow" : "blue",
      isLocked: false,
      rationale: "Auto-scheduled",
    });
    cursor += t.durationMin;
    sinceBreak += t.durationMin;
  }
  blocks.push({ startTime: fmt(windStart), endTime: fmt(sleepStart), taskName: "Wind down", type: "wind", color: "purple", isLocked: true, rationale: "Prepare for sleep" });
  blocks.push({ startTime: fmt(sleepStart), endTime: fmt(sleepStart + 30), taskName: "Sleep", type: "sleep", color: "indigo", isLocked: true, rationale: "Protected sleep" });
  return blocks;
}

export const generateSchedule = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      tasks: z.array(TaskSchema).max(30),
      preferences: PrefsSchema,
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { blocks: fallbackSchedule(data.tasks, data.preferences) };

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const system = `You are a schedule optimizer for an IB/IGCSE student. Given tasks: ${JSON.stringify(data.tasks)}, sleep goal: ${data.preferences.sleepGoalTime}, wake time: ${data.preferences.wakeTime}, energy: ${data.preferences.energy}, intensity: ${data.preferences.intensity}, date: ${data.preferences.date}. Generate an optimized daily schedule as JSON array of objects: {startTime, endTime, taskName, type, color, isLocked, rationale}. Rules: sleep block locked at sleep_goal_time, 30 min wind-down before sleep, 10 min break every 90 min, color=red for high priority/due soon, yellow=normal, blue=flexible, purple=wind-down, indigo=sleep. Never schedule past wind-down. Return ONLY a JSON array, no prose, no markdown.`;

    try {
      const { text } = await generateText({
        model,
        system,
        prompt: "Return the JSON array now.",
      });
      const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      const arr = z.array(BlockSchema).parse(parsed);
      // Always enforce sleep block
      const [sh, sm] = data.preferences.sleepGoalTime.split(":").map(Number);
      const sleepStr = `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`;
      const hasSleep = arr.some((b) => b.type === "sleep");
      if (!hasSleep) {
        const endH = (sh + 0) % 24;
        arr.push({ startTime: sleepStr, endTime: `${String(endH).padStart(2, "0")}:30`, taskName: "Sleep", type: "sleep", color: "indigo", isLocked: true, rationale: "Protected sleep" });
      }
      return { blocks: arr };
    } catch {
      return { blocks: fallbackSchedule(data.tasks, data.preferences) };
    }
  });

export const saveActiveSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      tasks: z.array(TaskSchema),
      blocks: z.array(BlockSchema),
      preferences: PrefsSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // deactivate previous
    await supabase.from("schedules").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
    const { data: inserted, error } = await supabase
      .from("schedules")
      .insert({
        user_id: userId,
        tasks: data.tasks,
        blocks: data.blocks,
        preferences: data.preferences,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const getActiveSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("schedules")
      .select("id, tasks, blocks, preferences, schedule_date")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { schedule: data };
  });
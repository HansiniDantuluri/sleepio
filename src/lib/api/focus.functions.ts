import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const startFocusSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      planned_minutes: z.number().int().min(1).max(240),
      task_name: z.string().max(200).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("focus_sessions")
      .insert({
        user_id: userId,
        planned_minutes: data.planned_minutes,
        task_name: data.task_name ?? null,
        status: "in_progress",
      })
      .select("id, planned_minutes, started_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const completeFocusSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      actual_minutes: z.number().int().min(0).max(240),
      xp_earned: z.number().int().min(0).max(1000),
      status: z.enum(["complete", "abandoned"]),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("focus_sessions")
      .update({
        actual_minutes: data.actual_minutes,
        xp_earned: data.xp_earned,
        status: data.status,
        ended_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFocusStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("focus_sessions")
      .select("xp_earned, status, started_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    const todayCount = (data ?? []).filter(
      (r) => r.status === "complete" && new Date(r.started_at) >= startOfDay,
    ).length;
    const totalXp = (data ?? []).reduce((sum, r) => sum + (r.xp_earned ?? 0), 0);
    return { todayCount, totalXp };
  });
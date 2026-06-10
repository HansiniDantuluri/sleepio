import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mark the current user as having completed onboarding and persist the
 * profile fields collected in the onboarding flow. Sets onboarded_at = now().
 */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      full_name: z.string().min(1).max(100).optional(),
      sleep_goal_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
      wake_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
      curriculum: z.enum(["IB", "IGCSE"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {
      onboarded_at: new Date().toISOString(),
      onboarding_completed: true,
    };
    if (data.full_name) patch.full_name = data.full_name;
    if (data.sleep_goal_time) {
      patch.sleep_goal_time = data.sleep_goal_time.length === 5
        ? `${data.sleep_goal_time}:00` : data.sleep_goal_time;
    }
    if (data.wake_time) {
      patch.wake_time = data.wake_time.length === 5
        ? `${data.wake_time}:00` : data.wake_time;
    }
    if (data.curriculum) patch.curriculum = data.curriculum;
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Returns whether the current user has finished onboarding (onboarded_at set).
 */
export const getOnboardingStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    return { onboarded: !!(data as { onboarded_at?: string | null } | null)?.onboarded_at };
  });
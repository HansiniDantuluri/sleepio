import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserSettings = {
  sleep_target_minutes: number;
  subjects: string[];
  notifications: {
    ia_reminders: boolean;
    sleep_reminder: boolean;
    focus_reminders: boolean;
    ia_lead_days: number[];
  };
  app_blocking: boolean;
};

const DEFAULT_SETTINGS: UserSettings = {
  sleep_target_minutes: 480,
  subjects: [],
  notifications: {
    ia_reminders: true,
    sleep_reminder: true,
    focus_reminders: true,
    ia_lead_days: [7, 3, 1],
  },
  app_blocking: false,
};

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profileRes, settingsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, full_name, sleep_goal_time, wake_time, curriculum, theme_mode")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select("sleep_target_minutes, subjects, notifications, app_blocking")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const settings: UserSettings = settingsRes.data
      ? {
          sleep_target_minutes: settingsRes.data.sleep_target_minutes ?? 480,
          subjects: (settingsRes.data.subjects as string[]) ?? [],
          notifications: {
            ...DEFAULT_SETTINGS.notifications,
            ...((settingsRes.data.notifications as Partial<UserSettings["notifications"]>) ?? {}),
          },
          app_blocking: settingsRes.data.app_blocking ?? false,
        }
      : DEFAULT_SETTINGS;

    return {
      profile: profileRes.data ?? null,
      settings,
    };
  });

export const updateProfileFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      full_name: z.string().min(1).max(100).optional(),
      sleep_goal_time: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/)
        .optional(),
      wake_time: z
        .string()
        .regex(/^\d{2}:\d{2}(:\d{2})?$/)
        .optional(),
      curriculum: z.enum(["IB", "IGCSE"]).optional(),
      theme_mode: z.enum(["auto", "productivity", "sleep"]).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertUserSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      sleep_target_minutes: z.number().int().min(240).max(720).optional(),
      subjects: z.array(z.string().min(1).max(60)).max(20).optional(),
      notifications: z
        .object({
          ia_reminders: z.boolean(),
          sleep_reminder: z.boolean(),
          focus_reminders: z.boolean(),
          ia_lead_days: z.array(z.number().int().min(0).max(30)).max(5),
        })
        .optional(),
      app_blocking: z.boolean().optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LunaContext = {
  name: string;
  curriculum: string;
  subjects: string[];
  sleepGoalTime: string | null;
  sleepTargetMinutes: number;
  lastSleepMinutes: number | null;
  upcomingIAs: { subject: string; title: string | null; due_date: string; daysAway: number }[];
  todayTaskCount: number;
};

export const getLunaContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const in14 = new Date(Date.now() + 14 * 86400_000).toISOString();

    const [profileRes, settingsRes, lastSleepRes, iasRes, scheduleRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, sleep_goal_time, curriculum")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select("sleep_target_minutes, subjects")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("sleep_sessions")
        .select("start_time, end_time")
        .eq("user_id", userId)
        .not("end_time", "is", null)
        .order("end_time", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("internal_assessments")
        .select("subject, ia_type, due_date")
        .eq("user_id", userId)
        .gte("due_date", nowIso.slice(0, 10))
        .lte("due_date", in14.slice(0, 10))
        .order("due_date", { ascending: true })
        .limit(5),
      supabase
        .from("schedules")
        .select("tasks")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const lastSleepMinutes =
      lastSleepRes.data?.start_time && lastSleepRes.data?.end_time
        ? Math.max(
            0,
            Math.round(
              (new Date(lastSleepRes.data.end_time).getTime() -
                new Date(lastSleepRes.data.start_time).getTime()) /
                60000,
            ),
          )
        : null;

    const today = new Date();
    const upcomingIAs = (iasRes.data ?? []).map((ia) => {
      const due = new Date(ia.due_date);
      const daysAway = Math.max(0, Math.ceil((due.getTime() - today.getTime()) / 86400_000));
      return { subject: ia.subject, title: ia.ia_type ?? null, due_date: ia.due_date, daysAway };
    });

    const tasks = (scheduleRes.data?.tasks as unknown[]) ?? [];
    const todayTaskCount = Array.isArray(tasks) ? tasks.length : 0;

    const ctx: LunaContext = {
      name: profileRes.data?.full_name?.split(" ")[0] ?? "",
      curriculum: profileRes.data?.curriculum ?? "IB",
      subjects: (settingsRes.data?.subjects as string[]) ?? [],
      sleepGoalTime: profileRes.data?.sleep_goal_time ?? null,
      sleepTargetMinutes: settingsRes.data?.sleep_target_minutes ?? 480,
      lastSleepMinutes,
      upcomingIAs,
      todayTaskCount,
    };
    return ctx;
  });

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const chatWithLuna = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(MessageSchema).min(1).max(40),
      context: z.object({
        name: z.string().max(80),
        curriculum: z.string().max(20),
        subjects: z.array(z.string().max(60)).max(20),
        sleepGoalTime: z.string().max(20).nullable(),
        sleepTargetMinutes: z.number().int().min(0).max(900),
        lastSleepMinutes: z.number().int().min(0).max(900).nullable(),
        upcomingIAs: z
          .array(
            z.object({
              subject: z.string().max(80),
              title: z.string().max(200).nullable(),
              due_date: z.string().max(40),
              daysAway: z.number().int().min(0).max(365),
            }),
          )
          .max(10),
      }),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { reply: "Luna is unavailable right now. Try again in a moment." };
    }
    const ctx = data.context;
    const hour = new Date().getHours();
    const pattern = hour < 12 ? "morning-focused" : hour < 18 ? "afternoon-steady" : "evening-wind-down";
    const iaList = ctx.upcomingIAs.length
      ? ctx.upcomingIAs
          .map((ia) => `${ia.subject} (${ia.title ?? "IA"}) in ${ia.daysAway}d`)
          .join(", ")
      : "none in next 14 days";
    const lastSleep = ctx.lastSleepMinutes
      ? `${Math.floor(ctx.lastSleepMinutes / 60)}h ${ctx.lastSleepMinutes % 60}m`
      : "unknown";
    const sleepGoal = `${Math.floor(ctx.sleepTargetMinutes / 60)}h${
      ctx.sleepGoalTime ? ` at ${ctx.sleepGoalTime}` : ""
    }`;

    const system = `You are Luna, a warm and slightly witty AI coach for an ${ctx.curriculum} student named ${
      ctx.name || "the student"
    }. You know: their subjects are ${ctx.subjects.join(", ") || "unset"}, curriculum: ${ctx.curriculum}, sleep goal: ${sleepGoal}, last night's sleep: ${lastSleep}, upcoming IAs: ${iaList}, energy pattern: ${pattern}.

Your personality: caring, smart, occasionally funny, never preachy. Like a brilliant older friend who actually gets IB stress.

Rules: keep responses under 120 words unless asked for more. Use line breaks for readability. Occasional emojis but not every sentence. Never give medical advice. If asked about something outside sleep/study/stress, gently redirect.

You can help with: sleep improvement, study strategies, IB/IGCSE subject tips, stress management, schedule questions, motivation, exam preparation.`;

    try {
      const gateway = createLovableAiGatewayProvider(key);
      const model = gateway("google/gemini-3-flash-preview");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);
      const { text } = await generateText({
        model,
        system,
        messages: data.messages.map((m) => ({ role: m.role, content: m.content })),
        abortSignal: controller.signal,
      });
      clearTimeout(timeout);
      return { reply: text.trim() };
    } catch {
      return { reply: "Luna is unavailable right now. Try again in a moment." };
    }
  });
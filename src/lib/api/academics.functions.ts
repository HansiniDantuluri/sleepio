import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const IAStatus = z.enum(["not_started", "in_progress", "submitted"]);

export const listIAs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("internal_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true });
    if (error) throw new Error(error.message);
    return { ias: data ?? [] };
  });

export const createIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      subject: z.string().min(1).max(80),
      ia_type: z.string().min(1).max(40),
      due_date: z.string().min(8).max(40),
      notes: z.string().max(2000).optional().nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("internal_assessments")
      .insert({ ...data, user_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateIAStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: IAStatus }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("internal_assessments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("internal_assessments")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("summative_exams")
      .select("*")
      .eq("user_id", userId)
      .order("exam_date", { ascending: true });
    if (error) throw new Error(error.message);
    return { exams: data ?? [] };
  });

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      subject: z.string().min(1).max(80),
      exam_date: z.string().min(8).max(40),
      exam_board: z.enum(["IB", "IGCSE"]),
      paper_type: z.string().min(1).max(40),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("summative_exams")
      .insert({ ...data, user_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("summative_exams")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const StudyBlock = z.object({
  subject: z.string(),
  minutes: z.number().int().min(15).max(240),
  focus: z.string(),
});
const StudyDay = z.object({ date: z.string(), blocks: z.array(StudyBlock) });
const StudyWeek = z.object({ start: z.string(), days: z.array(StudyDay) });
const StudyPlan = z.object({ weeks: z.array(StudyWeek) });

export const generateStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      exams: z.array(
        z.object({
          subject: z.string(),
          exam_date: z.string(),
          exam_board: z.string(),
          paper_type: z.string(),
        }),
      ),
      weeksAvailable: z.number().int().min(1).max(20).default(4),
      hoursPerDay: z.number().min(0.5).max(8).default(2),
      weakSubjects: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { plan: fallbackPlan(data) };
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");
    const prompt = `Generate a multi-week study plan for IB/IGCSE student. Exams: ${JSON.stringify(
      data.exams,
    )}. Available weeks: ${data.weeksAvailable}, hours/day: ${data.hoursPerDay}, weak subjects: ${JSON.stringify(
      data.weakSubjects,
    )}. Return JSON: {weeks:[{start, days:[{date, blocks:[{subject, minutes, focus}]}]}]}. Use spaced repetition. No study blocks on exam day itself. Return ONLY JSON.`;
    try {
      const { text } = await generateText({
        model,
        system: "You output strict JSON only. No prose, no markdown.",
        prompt,
      });
      const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      const parsed = StudyPlan.parse(JSON.parse(cleaned));
      return { plan: parsed };
    } catch {
      return { plan: fallbackPlan(data) };
    }
  });

function fallbackPlan(input: {
  exams: { subject: string; exam_date: string; exam_board: string; paper_type: string }[];
  weeksAvailable: number;
  hoursPerDay: number;
}) {
  const today = new Date();
  const weeks: z.infer<typeof StudyPlan>["weeks"] = [];
  for (let w = 0; w < input.weeksAvailable; w++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + w * 7);
    const days: z.infer<typeof StudyDay>[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + d);
      const iso = date.toISOString().slice(0, 10);
      const examOnDay = input.exams.some((e) => e.exam_date === iso);
      if (examOnDay) {
        days.push({ date: iso, blocks: [] });
        continue;
      }
      const subj = input.exams[(w + d) % Math.max(1, input.exams.length)]?.subject ?? "Review";
      days.push({
        date: iso,
        blocks: [
          { subject: subj, minutes: Math.round(input.hoursPerDay * 60), focus: "Practice + spaced review" },
        ],
      });
    }
    weeks.push({ start: weekStart.toISOString().slice(0, 10), days });
  }
  return { weeks };
}

export const saveStudyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ plan: StudyPlan }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("study_plans").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
    const { data: row, error } = await supabase
      .from("study_plans")
      .insert({ user_id: userId, plan: data.plan, is_active: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getActiveStudyPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("study_plans")
      .select("id, plan")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { plan: (data?.plan as z.infer<typeof StudyPlan> | undefined) ?? null, id: data?.id ?? null };
  });
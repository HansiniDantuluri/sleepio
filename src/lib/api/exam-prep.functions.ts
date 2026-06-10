import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PrepBlock = z.object({
  subject: z.string(),
  topic: z.string(),
  duration_min: z.number().int().min(15).max(240),
  technique: z.string(),
});
const PrepBreak = z.object({ time: z.string(), activity: z.string() });
const PrepDay = z.object({
  date: z.string(),
  study_blocks: z.array(PrepBlock),
  breaks: z.array(PrepBreak),
  sleep_time: z.string(),
});
const PrepPlan = z.object({ days: z.array(PrepDay) });

export const generateExamPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      subject: z.string().min(1).max(80),
      days: z.number().int().min(1).max(60),
      peakPattern: z.enum(["morning", "afternoon", "evening"]).default("morning"),
      schoolStart: z.string().default("08:30"),
      schoolEnd: z.string().default("15:30"),
      sleepTime: z.string().default("22:30"),
    }),
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    let plan: z.infer<typeof PrepPlan>;
    if (key) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");
        const prompt = `You are an IB/IGCSE exam preparation coach. Student has exam in ${data.subject} in ${data.days} days. Their peak productivity is ${data.peakPattern}. School hours are ${data.schoolStart}-${data.schoolEnd}. Sleep goal is ${data.sleepTime}. Generate a day-by-day study plan for the next ${data.days} days as JSON: {days:[{date, study_blocks:[{subject, topic, duration_min, technique}], breaks:[{time, activity}], sleep_time}]}. Use spaced repetition. Increase intensity closer to exam date. Never compromise sleep. Return ONLY JSON.`;
        const { text } = await generateText({
          model,
          system: "You output strict JSON only. No prose, no markdown.",
          prompt,
        });
        const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        plan = PrepPlan.parse(JSON.parse(cleaned));
      } catch {
        plan = fallbackPrep(data);
      }
    } else {
      plan = fallbackPrep(data);
    }

    const { supabase, userId } = context;
    await supabase.from("study_plans").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
    await supabase.from("study_plans").insert({ user_id: userId, plan, is_active: true });
    return { plan };
  });

function fallbackPrep(input: {
  subject: string; days: number; peakPattern: string; schoolStart: string; schoolEnd: string; sleepTime: string;
}): z.infer<typeof PrepPlan> {
  const peakStart = input.peakPattern === "morning" ? "06:30" : input.peakPattern === "afternoon" ? "16:00" : "19:30";
  const days: z.infer<typeof PrepDay>[] = [];
  const techniques = ["Active recall", "Past papers", "Feynman explanation", "Spaced review", "Flashcards"];
  for (let i = 0; i < input.days; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const intensity = Math.min(180, 60 + Math.round((i / input.days) * 120));
    days.push({
      date: d.toISOString().slice(0, 10),
      study_blocks: [
        { subject: input.subject, topic: `Module ${(i % 6) + 1}`, duration_min: intensity, technique: techniques[i % techniques.length] },
      ],
      breaks: [
        { time: addMin(peakStart, 90), activity: "15 min — rest your eyes" },
        { time: addMin(peakStart, 195), activity: "15 min — breathe" },
      ],
      sleep_time: input.sleepTime,
    });
  }
  return { days };
}

function addMin(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
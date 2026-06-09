import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";

export const getCoachMessage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().optional(), hour: z.number().min(0).max(23) }))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return { message: "You've got this — one focused block at a time." };
    }
    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");
    const partOfDay = data.hour < 12 ? "morning" : data.hour < 18 ? "afternoon" : "evening";
    try {
      const { text } = await generateText({
        model,
        system:
          "You are a warm sleep coach for an IB/IGCSE student. One sentence under 18 words, encouraging.",
        prompt: `It is ${partOfDay}.${data.name ? ` Student name: ${data.name}.` : ""} Write one short encouraging sentence.`,
      });
      return { message: text.trim() };
    } catch {
      return { message: "Small steps today add up to big wins tomorrow." };
    }
  });
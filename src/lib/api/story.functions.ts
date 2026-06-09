import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";

import { createLovableAiGatewayProvider } from "../ai-gateway.server";

const THEMES = [
  "forest journey",
  "ocean dream",
  "mountain adventure",
  "starry night",
  "garden of calm",
];

export const checkStoryAvailable = createServerFn({ method: "GET" })
  .handler(async () => {
    return {
      lovable: Boolean(process.env.LOVABLE_API_KEY),
      elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
    };
  });

export const generateBedtimeStory = createServerFn({ method: "POST" })
  .handler(async () => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("AI not configured");
    const theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    const gateway = createLovableAiGatewayProvider(lovableKey);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system:
        "You write calming bedtime stories for stressed teenagers. Use second person, gentle imagery, no conflict or suspense, end peacefully.",
      prompt: `Write a calming bedtime story for a stressed IB/IGCSE teenager. 300-400 words. 2nd person, gentle imagery, no conflict or suspense. End peacefully. Theme: ${theme}.`,
    });
    const storyText = text.trim();

    let audioBase64: string | null = null;
    let audioError: string | null = null;
    const elKey = process.env.ELEVENLABS_API_KEY;
    if (!elKey) {
      audioError = "ElevenLabs not configured";
    } else {
      try {
        const resp = await fetch(
          "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL?output_format=mp3_44100_128",
          {
            method: "POST",
            headers: {
              "xi-api-key": elKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: storyText,
              model_id: "eleven_multilingual_v2",
              voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.35, use_speaker_boost: true, speed: 0.9 },
            }),
          },
        );
        if (!resp.ok) {
          const err = await resp.text();
          audioError = `TTS failed (${resp.status}): ${err.slice(0, 120)}`;
        } else {
          const buf = await resp.arrayBuffer();
          audioBase64 = Buffer.from(buf).toString("base64");
        }
      } catch (e) {
        audioError = (e as Error).message;
      }
    }
    return { text: storyText, theme, audioBase64, audioError };
  });
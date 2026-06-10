export type SleepFact = {
  id: number;
  text: string;
  category: "impact" | "reinforcement" | "exam" | "circadian" | "general";
};

export const SLEEP_FACTS: SleepFact[] = [
  { id: 1, category: "impact", text: "😴 Missing 2 hours of sleep cuts your reaction time in half — same as being drunk." },
  { id: 2, category: "general", text: "🧠 While you sleep, your brain literally cleans itself. Skipping sleep = skipping the wash cycle." },
  { id: 3, category: "circadian", text: "⏰ Your body has a master clock in your brain called the SCN. Irregular sleep confuses it like jet lag every single day." },
  { id: 4, category: "exam", text: "📉 One bad night of sleep drops your memory retention by 40%." },
  { id: 5, category: "circadian", text: "🌅 Morning sunlight resets your body clock. 10 min outside in the morning = better sleep that night." },
  { id: 6, category: "general", text: "💊 Melatonin rises naturally 2 hours before your set sleep time. Screens block it completely." },
  { id: 7, category: "general", text: "🏃 Exercise improves sleep quality by 65% — but not within 2 hours of bedtime." },
  { id: 8, category: "impact", text: "😤 Stress hormone cortisol peaks in the morning. Poor sleep keeps it elevated all day — making everything harder." },
  { id: 9, category: "exam", text: "🎓 IB students who sleep 8h score on average 2 points higher than those sleeping under 6h." },
  { id: 10, category: "circadian", text: "🔄 Your circadian rhythm takes 3 weeks to fully reset. Consistency is everything." },
  { id: 11, category: "impact", text: "🍕 Just one night of poor sleep increases hunger hormones by 28% — you crave junk food the next day." },
  { id: 12, category: "impact", text: "🛡️ Sleeping under 6h cuts your immune response by 70%. You get sick more, recover slower." },
  { id: 13, category: "reinforcement", text: "🌙 Deep sleep is when your body releases growth hormone — vital for teen brain + body development." },
  { id: 14, category: "exam", text: "📚 Memories are consolidated during REM sleep. Pulling an all-nighter literally erases what you studied." },
  { id: 15, category: "impact", text: "📱 Phones in the bedroom cut average sleep by 50 minutes — even when you don't pick them up." },
  { id: 16, category: "general", text: "🌡️ Your core body temp drops ~1°C as you fall asleep. A cool room (16-19°C) helps trigger this." },
  { id: 17, category: "exam", text: "🧪 Students who sleep 8h before an exam recall 40% more than those who crammed all night." },
  { id: 18, category: "impact", text: "😔 Just one poor night triples your risk of feeling anxious or low the next day." },
  { id: 19, category: "reinforcement", text: "✨ A full night of sleep is the single most powerful brain booster known to science — better than any supplement." },
  { id: 20, category: "circadian", text: "🌃 Teens' body clocks are naturally shifted ~2 hours later. Going to bed at 10pm feels like 8pm to an adult." },
];

/** Deterministic fact-of-the-day from full set. */
export function factOfTheDay(seed = new Date().toISOString().slice(0, 10)): SleepFact {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SLEEP_FACTS[h % SLEEP_FACTS.length];
}

/** Pick a contextually relevant fact for a sleep duration in hours. */
export function factForSleep(hours: number): SleepFact {
  const pool = hours < 7
    ? SLEEP_FACTS.filter((f) => f.category === "impact")
    : SLEEP_FACTS.filter((f) => f.category === "reinforcement" || f.category === "general");
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Random fact from a category (or any). */
export function randomFact(category?: SleepFact["category"]): SleepFact {
  const pool = category ? SLEEP_FACTS.filter((f) => f.category === category) : SLEEP_FACTS;
  return pool[Math.floor(Math.random() * pool.length)];
}
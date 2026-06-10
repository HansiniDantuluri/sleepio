import { motion } from "framer-motion";
import { type SleepFact } from "../data/sleep-facts";

export function SleepFactCard({ fact, compact = false }: { fact: SleepFact; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={
        "rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md " +
        (compact ? "text-xs" : "text-sm")
      }
      style={{ WebkitBackdropFilter: "blur(12px)" }}
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Did you know?
      </p>
      <p className="leading-relaxed text-foreground/90">{fact.text}</p>
    </motion.div>
  );
}
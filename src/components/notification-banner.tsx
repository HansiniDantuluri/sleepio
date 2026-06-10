import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";

export type BannerType = "exam" | "ia" | "sleep" | "focus";

export type BannerData = {
  type: BannerType;
  message: string;
  to: string;
  sleepMode?: boolean;
};

const BORDER: Record<BannerType, string> = {
  exam: "oklch(0.6 0.22 25)",
  ia: "oklch(0.7 0.18 55)",
  sleep: "oklch(0.65 0.18 250)",
  focus: "oklch(0.65 0.18 150)",
};

export function NotificationBanner({
  banner,
  onDismiss,
}: {
  banner: BannerData | null;
  onDismiss: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!banner) return;
    const id = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(id);
  }, [banner, onDismiss]);

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          key={banner.type}
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed left-3 right-3 top-3 z-[60] mx-auto max-w-md"
        >
          <div
            onClick={() => {
              navigate({ to: banner.to });
              onDismiss();
            }}
            className={
              banner.sleepMode
                ? "flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 pl-4 text-white shadow-xl backdrop-blur-xl"
                : "flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-white p-3 pl-4 text-foreground shadow-lg"
            }
            style={{ borderLeft: `4px solid ${BORDER[banner.type]}` }}
            role="button"
            tabIndex={0}
          >
            <p className="flex-1 text-sm font-medium leading-snug">{banner.message}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className={
                banner.sleepMode
                  ? "shrink-0 rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
                  : "shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              }
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
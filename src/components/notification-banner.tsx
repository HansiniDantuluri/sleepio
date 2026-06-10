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
            className="flex cursor-pointer items-center gap-3 rounded-2xl shadow-xl p-3 pl-4"
            style={{
              borderLeft: `4px solid ${BORDER[banner.type]}`,
              background: banner.sleepMode ? "rgba(15, 10, 40, 0.95)" : "#ffffff",
              color: banner.sleepMode ? "#ffffff" : "#1a1a1a",
              backdropFilter: banner.sleepMode ? "blur(12px)" : undefined,
              border: banner.sleepMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
              borderLeft: `4px solid ${BORDER[banner.type]}`,
            }}
            role="button"
            tabIndex={0}
          >
            <p
              className="flex-1 leading-snug"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: banner.sleepMode ? "#ffffff" : "#1a1a1a",
              }}
            >
              {banner.message}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="shrink-0 rounded-full p-1 hover:opacity-80"
              style={{ color: banner.sleepMode ? "rgba(255,255,255,0.8)" : "#4a4a4a" }}
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
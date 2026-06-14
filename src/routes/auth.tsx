import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { completeOnboarding } from "../lib/api/onboarding.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SleepIO" },
      { name: "description", content: "Sign in or create your SleepIO account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const finishOnboarding = useServerFn(completeOnboarding);

  const handleSignedIn = async () => {
    // If an onboarding draft exists, persist it + mark onboarded.
    let draft: Record<string, unknown> = {};
    try {
      draft = JSON.parse(localStorage.getItem("onboarding_draft") || "{}");
    } catch {
      /* ignore */
    }
    if (draft && Object.keys(draft).length > 0) {
      try {
        await finishOnboarding({
          data: {
            sleep_goal_time: typeof draft.sleep_goal_time === "string" ? draft.sleep_goal_time : undefined,
            wake_time: typeof draft.wake_time === "string" ? draft.wake_time : undefined,
            curriculum: draft.curriculum === "IB" || draft.curriculum === "IGCSE" ? draft.curriculum : undefined,
            full_name: typeof draft.name === "string" ? draft.name : undefined,
          },
        });
        localStorage.removeItem("onboarding_draft");
      } catch {
        /* ignore — root guard will redirect to /onboarding if still not marked */
      }
    }
    navigate({ to: "/" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void handleSignedIn();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) void handleSignedIn();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // If no session was returned, email confirmation is required.
        // Switch to sign-in mode and show a clear success message instead of
        // silently waiting for an auth event that won't fire.
        if (!data.session) {
          setMode("signin");
          setInfo("Account created! You can now log in.");
          setEmail(cleanEmail);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const lower = raw.toLowerCase();
      if (
        lower.includes("invalid login") ||
        lower.includes("invalid credentials") ||
        lower.includes("invalid_credentials")
      ) {
        setError("Incorrect email or password. Try again or use Google sign in.");
      } else if (lower.includes("email not confirmed")) {
        setError("Please confirm your email from the link we sent, then sign in.");
      } else if (lower.includes("already registered") || lower.includes("user already")) {
        setError("An account with this email already exists. Try signing in instead.");
      } else {
        setError(raw || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-12">
        <div className="mb-8">
          <Link to="/" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            ← SleepIO
          </Link>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Save your plan and sync across devices."
              : "Sign in to pick up where you left off."}
          </p>
        </div>

        <form onSubmit={handleEmail} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Password
            </span>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-border bg-surface px-4 py-3 pr-12 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {info && (
            <p className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
              {info}
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {loading ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
          className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
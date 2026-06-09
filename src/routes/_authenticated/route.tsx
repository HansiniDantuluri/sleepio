import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }

    // Onboarding gate (skip for the onboarding route itself)
    if (location.pathname !== "/onboarding") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, sleep_goal_time, wake_time")
        .eq("id", data.user.id)
        .maybeSingle();

      // Hydrate local-storage schedule for the ThemeProvider auto switch
      if (profile?.sleep_goal_time) {
        localStorage.setItem("sleep_goal_time", profile.sleep_goal_time);
      }
      if (profile?.wake_time) {
        localStorage.setItem("wake_time", profile.wake_time);
      }
      if (profile?.sleep_goal_time || profile?.wake_time) {
        window.dispatchEvent(new Event("sleepio:schedule-changed"));
      }

      if (!profile?.onboarding_completed) {
        throw redirect({ to: "/onboarding" });
      }
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
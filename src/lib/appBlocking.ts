/**
 * App Blocking service.
 *
 * The intended Android implementation uses `@capacitor-community/app-usage`
 * to poll the foreground app via UsageStatsManager (PACKAGE_USAGE_STATS).
 * That package isn't available from the current npm registry mirror, so we
 * keep a graceful runtime stub here: it loads the plugin dynamically when
 * present on a native build, and degrades to a no-op (with a friendly
 * message on iOS / web) otherwise.
 */

import { supabase } from "@/integrations/supabase/client";

type PollHandle = { stop: () => void };

let active: PollHandle | null = null;

function isNativeAndroid(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap && typeof cap.getPlatform === "function" && cap.getPlatform() === "android";
}

function isNativeIOS(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap && typeof cap.getPlatform === "function" && cap.getPlatform() === "ios";
}

async function loadAppUsage(): Promise<any | null> {
  try {
    // Optional dep — only present in native Android builds.
    const specifier = "@capacitor-community/app-usage";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import(/* @vite-ignore */ specifier).catch(() => null);
    return mod?.AppUsage ?? null;
  } catch {
    return null;
  }
}

export async function getBlockedApps(): Promise<string[]> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [];
    const { data } = await supabase
      .from("user_settings")
      .select("blocked_apps")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    const list = (data as any)?.blocked_apps;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function requestUsagePermission(): Promise<{ granted: boolean; reason?: string }> {
  if (isNativeIOS()) {
    return { granted: false, reason: "App blocking available on Android only" };
  }
  if (!isNativeAndroid()) {
    return { granted: false, reason: "App blocking requires the Android build" };
  }
  const AppUsage = await loadAppUsage();
  if (!AppUsage) return { granted: false, reason: "Usage plugin not installed in this build" };
  try {
    const res = await AppUsage.requestPermission?.();
    return { granted: !!res?.granted };
  } catch (e) {
    return { granted: false, reason: (e as Error).message };
  }
}

async function notifyFocus(): Promise<void> {
  const msg = "Time to focus! Get back to SleepIO 💪";
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("SleepIO", { body: msg });
      return;
    }
  } catch {
    /* fallthrough */
  }
  // eslint-disable-next-line no-console
  console.warn("[appBlocking]", msg);
}

export async function startBlockingDuringFocus(): Promise<PollHandle> {
  if (active) return active;

  if (!isNativeAndroid()) {
    const handle: PollHandle = { stop: () => { active = null; } };
    active = handle;
    return handle;
  }

  const AppUsage = await loadAppUsage();
  const blocked = new Set(await getBlockedApps());

  if (!AppUsage || blocked.size === 0) {
    const handle: PollHandle = { stop: () => { active = null; } };
    active = handle;
    return handle;
  }

  const intervalId = setInterval(async () => {
    try {
      const res = await AppUsage.getForegroundApp?.();
      const pkg: string | undefined = res?.packageName;
      if (pkg && blocked.has(pkg)) {
        await notifyFocus();
      }
    } catch {
      /* ignore polling errors */
    }
  }, 30_000);

  const handle: PollHandle = {
    stop: () => {
      clearInterval(intervalId);
      active = null;
    },
  };
  active = handle;
  return handle;
}

export function stopBlocking(): void {
  active?.stop();
  active = null;
}

export function appBlockingPlatformMessage(): string | null {
  if (isNativeAndroid()) return null;
  if (isNativeIOS()) return "App blocking available on Android only";
  return "App blocking activates inside the Android build";
}
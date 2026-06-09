CREATE TABLE public.focus_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  task_name TEXT,
  planned_minutes INTEGER NOT NULL,
  actual_minutes INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own focus sessions" ON public.focus_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own focus sessions" ON public.focus_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own focus sessions" ON public.focus_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own focus sessions" ON public.focus_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_focus_sessions_user_started ON public.focus_sessions(user_id, started_at DESC);
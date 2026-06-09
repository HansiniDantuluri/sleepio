
-- sleep_sessions
CREATE TABLE public.sleep_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  status text NOT NULL DEFAULT 'active',
  mood_score smallint,
  felt_enough boolean,
  quality_score numeric(3,1),
  narrative text,
  target_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_sessions TO authenticated;
GRANT ALL ON public.sleep_sessions TO service_role;
ALTER TABLE public.sleep_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own sleep_sessions" ON public.sleep_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sleep_sessions" ON public.sleep_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sleep_sessions" ON public.sleep_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sleep_sessions" ON public.sleep_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_sleep_sessions_updated_at BEFORE UPDATE ON public.sleep_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- internal_assessments
CREATE TABLE public.internal_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  ia_type text NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'not_started',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_assessments TO authenticated;
GRANT ALL ON public.internal_assessments TO service_role;
ALTER TABLE public.internal_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own ias" ON public.internal_assessments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ias" ON public.internal_assessments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ias" ON public.internal_assessments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own ias" ON public.internal_assessments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_internal_assessments_updated_at BEFORE UPDATE ON public.internal_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- summative_exams
CREATE TABLE public.summative_exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  exam_date date NOT NULL,
  exam_board text NOT NULL,
  paper_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summative_exams TO authenticated;
GRANT ALL ON public.summative_exams TO service_role;
ALTER TABLE public.summative_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own exams" ON public.summative_exams FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own exams" ON public.summative_exams FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own exams" ON public.summative_exams FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own exams" ON public.summative_exams FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_summative_exams_updated_at BEFORE UPDATE ON public.summative_exams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- study_plans
CREATE TABLE public.study_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_plans TO authenticated;
GRANT ALL ON public.study_plans TO service_role;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own study_plans" ON public.study_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own study_plans" ON public.study_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own study_plans" ON public.study_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own study_plans" ON public.study_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_study_plans_updated_at BEFORE UPDATE ON public.study_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

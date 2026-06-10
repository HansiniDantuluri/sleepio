
-- Recreate policies scoped to authenticated role
DROP POLICY IF EXISTS "Users manage own achievements" ON public.achievements;
CREATE POLICY "Users manage own achievements" ON public.achievements
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "flashcard_decks owner" ON public.flashcard_decks;
CREATE POLICY "flashcard_decks owner" ON public.flashcard_decks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "flashcards owner" ON public.flashcards;
CREATE POLICY "flashcards owner" ON public.flashcards
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "study_notes owner" ON public.study_notes;
CREATE POLICY "study_notes owner" ON public.study_notes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own subjects" ON public.subjects;
CREATE POLICY "Users manage own subjects" ON public.subjects
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
CREATE POLICY "Users manage own tasks" ON public.tasks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for profiles
CREATE POLICY "Users can delete own profile" ON public.profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

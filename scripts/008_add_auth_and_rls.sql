-- Add Supabase Auth + per-user row-level security (RLS)
--
-- This migration introduces:
-- - public.profiles table for editable user profile fields
-- - user_id ownership on plants + import_sessions
-- - RLS policies so each user only sees/edits their own data
-- - care_history policies based on ownership of the parent plant

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles are readable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles are readable by owner" ON public.profiles FOR SELECT USING (id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles are insertable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles are insertable by owner" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles are updatable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles are updatable by owner" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
  END IF;
END
$$;

-- Auto-create profile row on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    EXECUTE 'DROP TRIGGER on_auth_user_created ON auth.users';
  END IF;

  EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()';
END
$$;

-- Add user_id ownership columns
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.import_sessions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_plants_user_id ON public.plants(user_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_user_id ON public.import_sessions(user_id);

-- Enable RLS
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_history ENABLE ROW LEVEL SECURITY;

-- Plants policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plants' AND policyname = 'plants are readable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "plants are readable by owner" ON public.plants FOR SELECT USING (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plants' AND policyname = 'plants are insertable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "plants are insertable by owner" ON public.plants FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plants' AND policyname = 'plants are updatable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "plants are updatable by owner" ON public.plants FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plants' AND policyname = 'plants are deletable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "plants are deletable by owner" ON public.plants FOR DELETE USING (user_id = auth.uid())';
  END IF;
END
$$;

-- Import sessions policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_sessions' AND policyname = 'import sessions are readable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "import sessions are readable by owner" ON public.import_sessions FOR SELECT USING (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_sessions' AND policyname = 'import sessions are insertable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "import sessions are insertable by owner" ON public.import_sessions FOR INSERT WITH CHECK (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_sessions' AND policyname = 'import sessions are updatable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "import sessions are updatable by owner" ON public.import_sessions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'import_sessions' AND policyname = 'import sessions are deletable by owner'
  ) THEN
    EXECUTE 'CREATE POLICY "import sessions are deletable by owner" ON public.import_sessions FOR DELETE USING (user_id = auth.uid())';
  END IF;
END
$$;

-- Care history policies (based on plant ownership)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'care_history' AND policyname = 'care history readable by plant owner'
  ) THEN
    EXECUTE '
      CREATE POLICY "care history readable by plant owner"
      ON public.care_history
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.plants p
          WHERE p.id = plant_id
            AND p.user_id = auth.uid()
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'care_history' AND policyname = 'care history insertable by plant owner'
  ) THEN
    EXECUTE '
      CREATE POLICY "care history insertable by plant owner"
      ON public.care_history
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.plants p
          WHERE p.id = plant_id
            AND p.user_id = auth.uid()
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'care_history' AND policyname = 'care history deletable by plant owner'
  ) THEN
    EXECUTE '
      CREATE POLICY "care history deletable by plant owner"
      ON public.care_history
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1 FROM public.plants p
          WHERE p.id = plant_id
            AND p.user_id = auth.uid()
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'care_history' AND policyname = 'care history updatable by plant owner'
  ) THEN
    EXECUTE '
      CREATE POLICY "care history updatable by plant owner"
      ON public.care_history
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.plants p
          WHERE p.id = plant_id
            AND p.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.plants p
          WHERE p.id = plant_id
            AND p.user_id = auth.uid()
        )
      )
    ';
  END IF;
END
$$;

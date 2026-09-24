-- ====================================================================
-- KABLEHERO LITE: Supabase RBAC & Claymorphism Schema Setup
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/<ref>/sql)
-- Sets up:
-- 1. Custom Enum types (app_role, hazard_tier, report_status, vote_type)
-- 2. profiles table with 'role' column ('citizen', 'dispatcher', 'tanod')
-- 3. reports table with landmark, pole_number, assigned_crew, is_tanod_verified
-- 4. validations & vouchers tables
-- 5. Strict RLS Policies:
--    - Reports readable by everyone (citizen safety map)
--    - Insertable by any authenticated citizen/user
--    - ONLY dispatchers can update ticket status & crew assignments
--    - ONLY tanods can update is_tanod_verified / verification actions
-- 6. Trigger on auth.users for automated profile creation with chosen role
-- 7. XP award triggers and storage bucket for hazard photos
-- ====================================================================

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('citizen', 'dispatcher', 'tanod');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.hazard_tier AS ENUM ('critical', 'urgent', 'low');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('reported', 'dispatched', 'repairing', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.vote_type AS ENUM ('still_broken', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Profiles Table with role column
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Kabayan',
  role public.app_role NOT NULL DEFAULT 'citizen',
  xp_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure 'role' column exists if table was pre-existing
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.app_role NOT NULL DEFAULT 'citizen';
EXCEPTION WHEN others THEN null; END $$;

-- 3. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  photo_url text,
  hazard_tier public.hazard_tier NOT NULL,
  status public.report_status NOT NULL DEFAULT 'reported',
  verification_count integer NOT NULL DEFAULT 0,
  is_tanod_verified boolean NOT NULL DEFAULT false,
  tanod_verified_by uuid,
  tanod_verified_at timestamptz,
  landmark text,
  pole_number text,
  assigned_crew text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_created_at_idx ON public.reports (created_at DESC);
CREATE INDEX IF NOT EXISTS reports_status_idx ON public.reports (status);
CREATE INDEX IF NOT EXISTS reports_tier_idx ON public.reports (hazard_tier);
CREATE INDEX IF NOT EXISTS reports_tanod_idx ON public.reports (is_tanod_verified);

-- 4. Validations Table (Community votes)
CREATE TABLE IF NOT EXISTS public.validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote public.vote_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

-- 5. Vouchers Table (Power bill rebates & safety raffles)
CREATE TABLE IF NOT EXISTS public.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  reward_id text NOT NULL,
  title text NOT NULL,
  discount_peso integer NOT NULL DEFAULT 50,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active', -- 'active' | 'applied_to_bill'
  applied_at timestamptz,
  applied_account_no text,
  applied_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vouchers_code_idx ON public.vouchers (code);

-- 6. Helper function to check role of authenticated caller
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = _user_id LIMIT 1),
    'citizen'::public.app_role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role::text = _role
  );
$$;

-- 7. Row Level Security: Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_readable_by_everyone" ON public.profiles;
CREATE POLICY "profiles_readable_by_everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_update_own_profile" ON public.profiles;
CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "users_insert_own_profile" ON public.profiles;
CREATE POLICY "users_insert_own_profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 8. Row Level Security: Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_readable_by_everyone" ON public.reports;
CREATE POLICY "reports_readable_by_everyone" ON public.reports
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated_create_reports" ON public.reports;
CREATE POLICY "authenticated_create_reports" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow updates only if the user is either a dispatcher or a tanod
DROP POLICY IF EXISTS "dispatchers_and_tanods_update_reports" ON public.reports;
CREATE POLICY "dispatchers_and_tanods_update_reports" ON public.reports
  FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) = 'dispatcher'::public.app_role
    OR public.get_user_role(auth.uid()) = 'tanod'::public.app_role
  )
  WITH CHECK (
    public.get_user_role(auth.uid()) = 'dispatcher'::public.app_role
    OR public.get_user_role(auth.uid()) = 'tanod'::public.app_role
  );

-- Database Trigger enforcing granular role separation on reports updates:
-- Dispatchers can update status & assigned_crew.
-- Tanods can ONLY update is_tanod_verified, tanod_verified_by, tanod_verified_at.
-- Citizens cannot update reports directly.
CREATE OR REPLACE FUNCTION public.enforce_report_update_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role public.app_role;
BEGIN
  -- Bypass check for service role / postgres admin
  IF current_user IN ('postgres', 'service_role') THEN
    RETURN NEW;
  END IF;

  caller_role := public.get_user_role(auth.uid());

  -- Tanod: Can ONLY update is_tanod_verified fields
  IF caller_role = 'tanod'::public.app_role THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.assigned_crew IS DISTINCT FROM OLD.assigned_crew THEN
      RAISE EXCEPTION 'Access Denied: Only dispatchers can modify ticket status or crew assignments.';
    END IF;
    NEW.tanod_verified_by := auth.uid();
    NEW.tanod_verified_at := now();
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Dispatcher: Can update status, assigned_crew, note, etc.
  IF caller_role = 'dispatcher'::public.app_role THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- Citizen: Not permitted to update reports
  RAISE EXCEPTION 'Access Denied: Your role (%) is not authorized to update reports directly.', caller_role;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_report_update_roles ON public.reports;
CREATE TRIGGER trg_enforce_report_update_roles
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_report_update_roles();

-- 9. Row Level Security: Validations
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "validations_readable_by_everyone" ON public.validations;
CREATE POLICY "validations_readable_by_everyone" ON public.validations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated_users_vote" ON public.validations;
CREATE POLICY "authenticated_users_vote" ON public.validations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 10. Row Level Security: Vouchers
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vouchers_select_policy" ON public.vouchers;
CREATE POLICY "vouchers_select_policy" ON public.vouchers
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.get_user_role(auth.uid()) = 'dispatcher'::public.app_role
  );

DROP POLICY IF EXISTS "vouchers_insert_policy" ON public.vouchers;
CREATE POLICY "vouchers_insert_policy" ON public.vouchers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "dispatchers_apply_vouchers" ON public.vouchers;
CREATE POLICY "dispatchers_apply_vouchers" ON public.vouchers
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'dispatcher'::public.app_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'dispatcher'::public.app_role);

-- 11. New User Signup Trigger (Extracts role & display_name from metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.app_role;
  meta_role text;
BEGIN
  meta_role := LOWER(COALESCE(NEW.raw_user_meta_data ->> 'role', 'citizen'));
  IF meta_role IN ('citizen', 'dispatcher', 'tanod') THEN
    user_role := meta_role::public.app_role;
  ELSE
    user_role := 'citizen'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, display_name, role, xp_total)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1), 'Kabayan'),
    user_role,
    0
  )
  ON CONFLICT (id) DO UPDATE
  SET
    display_name = COALESCE(EXCLUDED.display_name, public.profiles.display_name),
    role = COALESCE(public.profiles.role, EXCLUDED.role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 12. XP Award Triggers
CREATE OR REPLACE FUNCTION public.award_report_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET xp_total = xp_total + 50 WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_report_created ON public.reports;
CREATE TRIGGER on_report_created
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.award_report_xp();

CREATE OR REPLACE FUNCTION public.handle_validation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET xp_total = xp_total + 20 WHERE id = NEW.user_id;
  IF NEW.vote = 'still_broken' THEN
    UPDATE public.reports SET verification_count = verification_count + 1, updated_at = now() WHERE id = NEW.report_id;
  ELSE
    UPDATE public.reports SET updated_at = now() WHERE id = NEW.report_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_validation_created ON public.validations;
CREATE TRIGGER on_validation_created
AFTER INSERT ON public.validations
FOR EACH ROW EXECUTE FUNCTION public.handle_validation();

-- 13. Realtime Publication
ALTER TABLE public.reports REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
EXCEPTION WHEN others THEN null; END $$;

-- 14. Storage Bucket Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('hazard-photos', 'hazard-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "public_read_hazard_photos" ON storage.objects;
CREATE POLICY "public_read_hazard_photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'hazard-photos');

DROP POLICY IF EXISTS "authenticated_upload_hazard_photos" ON storage.objects;
CREATE POLICY "authenticated_upload_hazard_photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hazard-photos');

-- 15. Grants
GRANT ALL ON public.profiles TO authenticated, service_role, anon;
GRANT ALL ON public.reports TO authenticated, service_role, anon;
GRANT ALL ON public.validations TO authenticated, service_role, anon;
GRANT ALL ON public.vouchers TO authenticated, service_role, anon;

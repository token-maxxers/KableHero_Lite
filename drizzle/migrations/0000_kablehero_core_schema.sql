-- Enums
CREATE TYPE public.app_role AS ENUM ('citizen', 'dispatcher', 'tanod');
CREATE TYPE public.hazard_tier AS ENUM ('critical', 'urgent', 'low');
CREATE TYPE public.report_status AS ENUM ('reported', 'dispatched', 'resolved');
CREATE TYPE public.vote_type AS ENUM ('still_broken', 'resolved');

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT 'Kabayan',
  xp_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Reports
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  photo_url text,
  hazard_tier public.hazard_tier NOT NULL,
  status public.report_status NOT NULL DEFAULT 'reported',
  verification_count integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reports_created_at_idx ON public.reports (created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT SELECT ON public.reports TO anon;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports readable by everyone" ON public.reports FOR SELECT USING (true);
CREATE POLICY "authenticated users create reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dispatchers update reports" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'tanod'))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher') OR public.has_role(auth.uid(), 'tanod'));

-- Validations
CREATE TABLE public.validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  vote public.vote_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);
GRANT SELECT, INSERT ON public.validations TO authenticated;
GRANT SELECT ON public.validations TO anon;
GRANT ALL ON public.validations TO service_role;
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "validations readable by everyone" ON public.validations FOR SELECT USING (true);
CREATE POLICY "authenticated users vote" ON public.validations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- New user bootstrap
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1), 'Kabayan'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'citizen')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- XP for reports
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
CREATE TRIGGER on_report_created
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.award_report_xp();

-- XP + verification count for validations
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
CREATE TRIGGER on_validation_created
AFTER INSERT ON public.validations
FOR EACH ROW EXECUTE FUNCTION public.handle_validation();

-- Realtime
ALTER TABLE public.reports REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

-- Storage policies for hazard photos (private bucket, signed URLs)
CREATE POLICY "authenticated read hazard photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hazard-photos');
CREATE POLICY "authenticated upload hazard photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hazard-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
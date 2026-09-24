-- KableHero Feature Schema Extension
-- Adds columns for landmarks, pole stencil codes, crew assignment, and voucher rewards

-- 1. Extend reports table if columns not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'landmark') THEN
    ALTER TABLE public.reports ADD COLUMN landmark text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'pole_number') THEN
    ALTER TABLE public.reports ADD COLUMN pole_number text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'assigned_crew') THEN
    ALTER TABLE public.reports ADD COLUMN assigned_crew text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'is_tanod_verified') THEN
    ALTER TABLE public.reports ADD COLUMN is_tanod_verified boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Vouchers table for electric bill discounts and safety raffles
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

-- Index for fast voucher lookups by code
CREATE INDEX IF NOT EXISTS vouchers_code_idx ON public.vouchers (code);

-- RLS for vouchers
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vouchers readable by owner or dispatchers" ON public.vouchers
  FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'dispatcher'));

CREATE POLICY "authenticated users claim vouchers" ON public.vouchers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "dispatchers apply vouchers" ON public.vouchers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher'));

DO $$
BEGIN
  IF to_regclass('public.change_risks') IS NOT NULL
     AND to_regclass('public.risk_register') IS NULL THEN
    ALTER TABLE public.change_risks RENAME TO risk_register;
  END IF;
END $$;

ALTER TABLE IF EXISTS public.risk_register
  ADD COLUMN IF NOT EXISTS risk_score integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF to_regclass('public.risk_register') IS NOT NULL THEN
    UPDATE public.risk_register
    SET risk_score = COALESCE(impact, 0) * COALESCE(likelihood, 0)
    WHERE risk_score = 0;

    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'change_risks_change_status_idx')
       AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'risk_register_change_status_idx') THEN
      ALTER INDEX public.change_risks_change_status_idx RENAME TO risk_register_change_status_idx;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'change_risks_owner_idx')
       AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'risk_register_owner_idx') THEN
      ALTER INDEX public.change_risks_owner_idx RENAME TO risk_register_owner_idx;
    END IF;
  END IF;
END $$;

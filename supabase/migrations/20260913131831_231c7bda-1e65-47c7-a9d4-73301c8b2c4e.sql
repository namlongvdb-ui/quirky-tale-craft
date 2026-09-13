CREATE TABLE public.app_data (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_data TO authenticated;
GRANT ALL ON public.app_data TO service_role;

ALTER TABLE public.app_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shared app data"
  ON public.app_data FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert shared app data"
  ON public.app_data FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shared app data"
  ON public.app_data FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shared app data"
  ON public.app_data FOR DELETE TO authenticated
  USING (true);

CREATE TRIGGER update_app_data_updated_at
  BEFORE UPDATE ON public.app_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
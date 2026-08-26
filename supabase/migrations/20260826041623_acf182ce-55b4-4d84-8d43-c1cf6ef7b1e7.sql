CREATE TABLE public.voucher_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id text NOT NULL,
  voucher_type text NOT NULL,
  doc_type text NOT NULL DEFAULT 'hoa_don',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT voucher_attachments_doc_type_check CHECK (doc_type IN ('hoa_don','to_trinh','du_toan','khac'))
);

CREATE INDEX idx_voucher_attachments_voucher ON public.voucher_attachments (voucher_type, voucher_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voucher_attachments TO authenticated;
GRANT ALL ON public.voucher_attachments TO service_role;

ALTER TABLE public.voucher_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Uploaders and workflow roles can view attachments"
ON public.voucher_attachments FOR SELECT TO authenticated
USING (
  auth.uid() = uploaded_by
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'lanh_dao')
  OR public.has_role(auth.uid(), 'ke_toan')
);

CREATE POLICY "Users can add own attachments"
ON public.voucher_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Uploaders can update own attachments"
ON public.voucher_attachments FOR UPDATE TO authenticated
USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Uploaders or admins can delete attachments"
ON public.voucher_attachments FOR DELETE TO authenticated
USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_voucher_attachments_updated_at
BEFORE UPDATE ON public.voucher_attachments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies: files stored under <auth.uid()>/<voucher_type>/<voucher_id>/<file>
CREATE POLICY "Users can upload own voucher attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'voucher-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners and workflow roles can read voucher attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'voucher-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'lanh_dao')
    OR public.has_role(auth.uid(), 'ke_toan')
  )
);

CREATE POLICY "Owners and admins can delete voucher attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'voucher-attachments'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin')
  )
);
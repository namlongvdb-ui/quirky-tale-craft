DROP POLICY IF EXISTS "Signers can update pending vouchers" ON public.pending_vouchers;
CREATE POLICY "Signers can update pending vouchers"
ON public.pending_vouchers
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'lanh_dao')
  OR public.has_role(auth.uid(), 'ke_toan')
  OR public.has_role(auth.uid(), 'phu_trach_dia_ban')
  OR public.has_role(auth.uid(), 'admin')
  OR auth.uid() = created_by
)
WITH CHECK (
  public.has_role(auth.uid(), 'lanh_dao')
  OR public.has_role(auth.uid(), 'ke_toan')
  OR public.has_role(auth.uid(), 'phu_trach_dia_ban')
  OR public.has_role(auth.uid(), 'admin')
  OR auth.uid() = created_by
);

-- Backfill: vouchers already signed by an area rep / accountant but still marked pending
UPDATE public.pending_vouchers pv
SET status = 'partially_signed'
WHERE pv.status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.voucher_signatures vs
    WHERE vs.voucher_id = pv.voucher_id AND vs.voucher_type = pv.voucher_type
  );
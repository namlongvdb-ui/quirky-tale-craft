import { toast } from 'sonner';
import { notificationsApi, pendingVouchersApi, voucherSignaturesApi } from '@/lib/api-client';
import { getServerPrivateKey, hashData, signData } from '@/lib/crypto-utils';
import { getSigningStep, getUserIdsByRole, getVoucherLabel, notifyCreatorToprint, notifyFirstSigners, notifyLeaderAfterFirstSign, submitVoucherForSigning } from '@/lib/notification-utils';
import { emitNotificationsRefresh } from '@/lib/notification-events';

export type VoucherType = 'thu' | 'chi' | 'tham-hoi' | 'de-nghi';

type PendingVoucherRecord = {
  id: string;
  voucher_id: string;
  voucher_type: string;
  created_by: string;
  status: string;
};

function isPendingVoucherRecord(v: unknown): v is PendingVoucherRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.voucher_id === 'string' &&
    typeof r.voucher_type === 'string' &&
    typeof r.created_by === 'string' &&
    typeof r.status === 'string'
  );
}

async function resolvePendingVoucher(voucherId: string, voucherType: string): Promise<PendingVoucherRecord | null> {
  const { data } = await pendingVouchersApi.getAll();
  const list = (Array.isArray(data) ? data : []) as unknown[];
  for (const v of list) {
    if (!isPendingVoucherRecord(v)) continue;
    if (v.voucher_id === voucherId && v.voucher_type === voucherType) return v;
  }
  return null;
}

function buildSigningPayload(voucherId: string, voucherType: VoucherType, voucherData: Record<string, unknown>) {
  // Keep payload stable across signing UIs
  const d = voucherData as Record<string, unknown>;
  return JSON.stringify({
    voucherNo: (d.voucherNo as string | undefined) || voucherId,
    date: d.date,
    amount: d.amount,
    description: d.description,
    personName: d.personName,
    type: voucherType,
    thamHoiSigningMode: d.thamHoiSigningMode,
  });
}

async function markOwnSignRequestAsRead(voucherId: string, voucherType: VoucherType) {
  try {
    await notificationsApi.markRelatedRead({
      relatedVoucherId: voucherId,
      relatedVoucherType: voucherType,
      type: 'sign_request',
    });
    emitNotificationsRefresh();
  } catch (err) {
    console.warn('Không thể cập nhật trạng thái thông báo ký duyệt', err);
  }
}

export async function submitVoucherForSigningWithNotify(params: {
  voucherId: string;
  voucherType: VoucherType;
  voucherData: Record<string, unknown>;
  createdBy: string;
  creatorName: string;
  areaName?: string;
}) {
  const t = toast.loading('Đang gửi chứng từ vào luồng ký…');
  try {
    await submitVoucherForSigning(params.voucherId, params.voucherType, params.voucherData, params.createdBy);
    const label = getVoucherLabel(params.voucherType);
    // Phiếu thu/chi: kế toán ký ngay trên form — không gửi thông báo bước 1 (tránh tự thông báo).
    if (params.voucherType !== 'thu' && params.voucherType !== 'chi') {
      await notifyFirstSigners(params.voucherId, params.voucherType, label, params.creatorName, params.areaName);
    }
    toast.success('Đã gửi chờ ký và thông báo người ký bước đầu', { id: t });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err || 'Unknown');
    toast.error('Không thể gửi chờ ký: ' + message, { id: t });
    throw err;
  }
}

export async function signVoucherWith3StepNotify(params: {
  voucherId: string;
  voucherType: VoucherType;
  voucherData: Record<string, unknown>;
  signerId: string;
  signerName: string;
  signPassword?: string;
  stepBeforeSign?: 'pending' | 'first_signed' | 'fully_signed';
  pendingVoucherId?: string;
  creatorId?: string;
}) {
  const toastId = toast.loading('Đang ký chứng từ…');
  try {
    const vd = params.voucherData as Record<string, unknown>;

    // IMPORTANT: Determine the step BEFORE writing the new signature.
    const stepBefore =
      params.stepBeforeSign || await getSigningStep(params.voucherId, params.voucherType, vd);

    if (
      stepBefore === 'pending' &&
      params.voucherType === 'tham-hoi' &&
      vd?.thamHoiSigningMode === 'leader_only'
    ) {
      const leaderIds = await getUserIdsByRole('lanh_dao');
      if (!leaderIds.includes(params.signerId)) {
        toast.error('Chỉ lãnh đạo được ký giấy đề nghị thăm hỏi không phân địa bàn cụ thể.', { id: toastId });
        return { ok: false as const, reason: 'wrong_signer' as const };
      }
    }

    let privateKey: string | null = null;
    {
      if (!params.signPassword) {
        toast.error('Vui lòng nhập mật khẩu ký số', { id: toastId });
        return { ok: false as const, reason: 'missing_password' as const };
      }
      privateKey = await getServerPrivateKey(params.signerId, params.signPassword);
    }

    if (!privateKey) {
      toast.error('Không thể giải mã khóa bí mật. Kiểm tra lại mật khẩu ký.', { id: toastId });
      return { ok: false as const, reason: 'unlock_failed' as const };
    }

    const dataStr = buildSigningPayload(params.voucherId, params.voucherType, params.voucherData);
    const dataHash = await hashData(dataStr);
    const signature = await signData(privateKey, dataStr);

    const { error } = await voucherSignaturesApi.create({
      voucherId: params.voucherId,
      voucherType: params.voucherType,
      signature,
      dataHash,
    });

    if (error) {
      if (error.code === '23505') {
        toast.success('Chứng từ này đã được bạn ký trước đó', { id: toastId });
        return { ok: false as const, reason: 'already_signed' as const };
      }
      throw new Error(error.message || 'Không thể lưu chữ ký');
    }

    const label = getVoucherLabel(params.voucherType);
    await markOwnSignRequestAsRead(params.voucherId, params.voucherType);

    // Step 2/3 notifications and status updates live here to keep the chain consistent
    let pendingRecord: PendingVoucherRecord | null = null;
    if (params.pendingVoucherId) {
      pendingRecord = { id: params.pendingVoucherId, voucher_id: params.voucherId, voucher_type: params.voucherType, created_by: params.creatorId || '', status: '' };
    } else {
      pendingRecord = await resolvePendingVoucher(params.voucherId, params.voucherType);
    }

    if (stepBefore === 'first_signed') {
      // Leadership signs -> complete
      if (pendingRecord?.id) {
        await pendingVouchersApi.update(pendingRecord.id, { status: 'signed', signed_at: new Date().toISOString() });
      }

      const creatorId = params.creatorId || pendingRecord?.created_by;
      if (creatorId) {
        await notifyCreatorToprint(creatorId, params.voucherId, params.voucherType, label, params.signerName);
      }

      toast.success(`Đã ký duyệt hoàn tất. Đã thông báo người lập để in ${label}`, { id: toastId });
      return { ok: true as const, step: 'fully_signed' as const };
    }

    if (stepBefore === 'pending') {
      // Thăm hỏi không có phụ trách địa bàn: một lần ký lãnh đạo là xong
      if (params.voucherType === 'tham-hoi' && vd?.thamHoiSigningMode === 'leader_only') {
        if (pendingRecord?.id) {
          await pendingVouchersApi.update(pendingRecord.id, { status: 'signed', signed_at: new Date().toISOString() });
        }
        const creatorId = params.creatorId || pendingRecord?.created_by;
        if (creatorId) {
          await notifyCreatorToprint(creatorId, params.voucherId, params.voucherType, label, params.signerName);
        }
        toast.success(`Đã ký duyệt hoàn tất. Đã thông báo người lập để in ${label}`, { id: toastId });
        return { ok: true as const, step: 'fully_signed' as const };
      }

      // First signer (kế toán / phụ trách địa bàn) -> notify leader
      if (pendingRecord?.id) {
        await pendingVouchersApi.update(pendingRecord.id, { status: 'partially_signed' });
      }
      await notifyLeaderAfterFirstSign(params.voucherId, params.voucherType, label, params.signerName);
      toast.success(`Đã ký duyệt bước đầu. Đã thông báo lãnh đạo ký tiếp ${label}`, { id: toastId });
      return { ok: true as const, step: 'first_signed' as const };
    }

    // fully_signed or unknown: nothing to notify
    toast.success(`Đã ký duyệt ${label}`, { id: toastId });
    return { ok: true as const, step: 'unknown' as const };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err || 'Unknown');
    toast.error(`Không thể ký: ${message}`, { id: toastId });
    return { ok: false as const, reason: 'error' as const, error: err };
  }
}


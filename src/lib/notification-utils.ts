import { notificationsApi, rolesApi, profilesApi, voucherSignaturesApi, pendingVouchersApi, digitalSignaturesApi } from '@/lib/api-client';

/** So khớp chuỗi địa bàn / tên tổ, bỏ qua hoa thường và dấu */
function normalizeForMatch(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Get user IDs by role
export async function getUserIdsByRole(role: string): Promise<string[]> {
  const { data } = await rolesApi.getAll();
  return data ? data.filter((d: any) => d.role === role).map((d: any) => d.user_id) : [];
}

// Get area rep user IDs for a specific area
export async function getAreaRepsByArea(areaName: string): Promise<string[]> {
  const areaRepIds = await getUserIdsByRole('phu_trach_dia_ban');
  if (areaRepIds.length === 0) return [];

  const { data: profiles } = await profilesApi.getAll();
  const haystack = normalizeForMatch(areaName);

  const filtered = (profiles || []).filter((p: any) => {
    if (!p.assigned_area || !areaRepIds.includes(p.user_id)) return false;
    const areas = p.assigned_area.split(',').map((a: string) => a.trim());
    return areas.some((area: string) => {
      const needle = normalizeForMatch(area);
      if (!needle || !haystack) return false;
      return haystack.includes(needle) || needle.includes(haystack);
    });
  });

  return filtered.map((p: any) => p.user_id);
}

export async function getSignerUserIds(): Promise<string[]> {
  const { data } = await digitalSignaturesApi.get(undefined, true);
  return data ? [...new Set(data.map((d: any) => d.user_id))] : [];
}

// Step 1: Thăm hỏi → phụ trách đúng địa bàn, hoặc lãnh đạo nếu không có địa bàn; không gửi kế toán.
//         Đề nghị thanh toán / phiếu thu chi → chỉ kế toán (thu chi xử lý ký ngay tại form, không dùng bước này).
export async function notifyFirstSigners(
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  creatorName: string,
  areaName?: string
) {
  let signerIds: string[] = [];

  if (voucherType === 'tham-hoi') {
    if (areaName) {
      signerIds = await getAreaRepsByArea(areaName);
    }
    if (signerIds.length === 0) {
      signerIds = await getUserIdsByRole('lanh_dao');
    }
  } else if (voucherType === 'thu' || voucherType === 'chi') {
    signerIds = await getUserIdsByRole('lanh_dao');
  } else {
    signerIds = await getUserIdsByRole('ke_toan');
  }

  if (signerIds.length === 0) return;

  for (const userId of signerIds) {
    await notificationsApi.create({
      userId,
      type: 'sign_request',
      title: 'Chứng từ mới cần ký duyệt',
      message: `${creatorName} đã tạo ${voucherLabel} số ${voucherId}. Vui lòng ký duyệt.`,
      relatedVoucherId: voucherId,
      relatedVoucherType: voucherType,
    });
  }
}

// Step 2: Kế toán / phụ trách địa bàn ký xong → thông báo lãnh đạo
export async function notifyLeaderAfterFirstSign(
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  signerName: string
) {
  const leaderIds = await getUserIdsByRole('lanh_dao');
  if (leaderIds.length === 0) return;

  const roleName = voucherType === 'tham-hoi' ? 'Phụ trách địa bàn' : 'Kế toán';

  for (const userId of leaderIds) {
    await notificationsApi.create({
      userId,
      type: 'sign_request',
      title: 'Chứng từ đã qua bước duyệt đầu',
      message: `${roleName} ${signerName} đã ký ${voucherLabel} số ${voucherId}. Vui lòng ký duyệt.`,
      relatedVoucherId: voucherId,
      relatedVoucherType: voucherType,
    });
  }
}

// Step 3: Lãnh đạo ký xong → thông báo người lập (in chứng từ hoặc đã ký đủ đề nghị thanh toán)
export async function notifyCreatorToprint(
  creatorId: string,
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  signerName: string,
  options?: { completionKind?: 'print_default' | 'payment_fully_signed' }
) {
  const kind = options?.completionKind ?? (voucherType === 'de-nghi' ? 'payment_fully_signed' : 'print_default');

  const title =
    kind === 'payment_fully_signed'
      ? 'Giấy đề nghị thanh toán đã ký đủ'
      : 'Chứng từ đã hoàn thành ký duyệt';

  const message =
    kind === 'payment_fully_signed'
      ? `Lãnh đạo ${signerName} đã ký ${voucherLabel} số ${voucherId}. Chứng từ đã hoàn tất ký duyệt — bạn có thể in và theo dõi.`
      : `Lãnh đạo ${signerName} đã ký ${voucherLabel} số ${voucherId}. Chứng từ đã hoàn thành quy trình duyệt — bạn có thể in.`;

  await notificationsApi.create({
    userId: creatorId,
    type: 'ready_to_print',
    title,
    message,
    relatedVoucherId: voucherId,
    relatedVoucherType: voucherType,
  });
}

// Legacy aliases
export async function notifySigners(
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  creatorName: string,
  areaName?: string
) {
  await notifyFirstSigners(voucherId, voucherType, voucherLabel, creatorName, areaName);
}

export async function notifyCreator(
  creatorId: string,
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  signerName: string
) {
  await notifyCreatorToprint(creatorId, voucherId, voucherType, voucherLabel, signerName);
}

export async function submitVoucherForSigning(
  voucherId: string,
  voucherType: string,
  voucherData: Record<string, any>,
  createdBy: string
) {
  await pendingVouchersApi.create({
    voucherId,
    voucherType,
    voucherData,
    createdBy,
  });
}

export async function getSigningStep(
  voucherId: string,
  voucherType: string,
  voucherData?: Record<string, any>
): Promise<'pending' | 'first_signed' | 'fully_signed'> {
  const { data: sigs } = await voucherSignaturesApi.get(voucherId, voucherType);

  if (!sigs || sigs.length === 0) return 'pending';

  const signerIdsSet = new Set(sigs.map((s: any) => s.signer_id));

  const leaderIds = await getUserIdsByRole('lanh_dao');
  const leaderSigned = leaderIds.some(id => signerIdsSet.has(id));

  if (voucherType === 'tham-hoi' && voucherData?.thamHoiSigningMode === 'leader_only') {
    if (leaderSigned) return 'fully_signed';
    return 'pending';
  }

  if (leaderSigned) return 'fully_signed';

  if (voucherType === 'thu' || voucherType === 'chi') {
    // Thu/chi only needs leader signature now. If not signed by leader, it's still pending.
    return 'pending';
  }

  if (voucherType === 'tham-hoi') {
    const areaRepIds = await getUserIdsByRole('phu_trach_dia_ban');
    if (areaRepIds.some(id => signerIdsSet.has(id))) return 'first_signed';
  } else {
    const accountantIds = await getUserIdsByRole('ke_toan');
    if (accountantIds.some(id => signerIdsSet.has(id))) return 'first_signed';
  }

  return 'pending';
}

const voucherTypeLabels: Record<string, string> = {
  'thu': 'Phiếu thu',
  'chi': 'Phiếu chi',
  'tham-hoi': 'Giấy đề nghị thăm hỏi',
  'de-nghi': 'Giấy đề nghị thanh toán',
};

export function getVoucherLabel(type: string): string {
  return voucherTypeLabels[type] || type;
}

import { supabase } from '@/integrations/supabase/client';
import {
  fetchDirectoryProfiles,
  fetchDirectoryUserRoles,
  fetchSignaturePublicKeys,
} from '@/lib/directory';

// Get user IDs by role (uses directory RPC)
export async function getUserIdsByRole(role: string): Promise<string[]> {
  const roles = await fetchDirectoryUserRoles(true);
  return roles.filter(r => r.role === (role as any)).map(r => r.user_id);
}

// Get area rep user IDs for a specific area
export async function getAreaRepsByArea(areaName: string): Promise<string[]> {
  const areaRepIds = await getUserIdsByRole('phu_trach_dia_ban');
  if (areaRepIds.length === 0) return [];

  const profiles = await fetchDirectoryProfiles(true);
  const repProfiles = profiles.filter(p => areaRepIds.includes(p.user_id) && p.assigned_area);

  const filtered = repProfiles.filter(p => {
    if (!p.assigned_area) return false;
    const areas = p.assigned_area.split(',').map(a => a.trim());
    return areas.some(area => areaName.includes(area));
  });

  return filtered.map(p => p.user_id);
}

export async function getSignerUserIds(): Promise<string[]> {
  const keys = await fetchSignaturePublicKeys(true);
  return [...new Set(keys.filter(k => k.is_active).map(k => k.user_id))];
}

async function sendWorkflowNotifications(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  voucherId?: string,
  voucherType?: string,
) {
  await Promise.all(
    userIds.map(uid =>
      supabase.rpc('create_workflow_notification', {
        p_user_id: uid,
        p_type: type,
        p_title: title,
        p_message: message,
        p_voucher_id: voucherId,
        p_voucher_type: voucherType,
      }),
    ),
  );
}

/**
 * Workflow luân chuyển chứng từ:
 * 1. Người lập tạo chứng từ → thông báo kế toán (thu/chi/đề nghị) hoặc phụ trách địa bàn (thăm hỏi)
 * 2. Kế toán / phụ trách địa bàn ký xong → thông báo lãnh đạo
 * 3. Lãnh đạo ký xong → thông báo người lập để in chứng từ
 */

export async function notifyFirstSigners(
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  creatorName: string,
  areaName?: string,
) {
  let signerIds: string[] = [];

  if (voucherType === 'tham-hoi') {
    if (areaName) signerIds = await getAreaRepsByArea(areaName);
    if (signerIds.length === 0) signerIds = await getUserIdsByRole('phu_trach_dia_ban');
  } else {
    signerIds = await getUserIdsByRole('ke_toan');
  }

  if (signerIds.length === 0) return;

  await sendWorkflowNotifications(
    signerIds,
    'sign_request',
    'Chứng từ mới cần ký duyệt',
    `${creatorName} đã tạo ${voucherLabel} số ${voucherId}. Vui lòng ký duyệt.`,
    voucherId,
    voucherType,
  );
}

export async function notifyLeaderAfterFirstSign(
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  signerName: string,
) {
  const leaderIds = await getUserIdsByRole('lanh_dao');
  if (leaderIds.length === 0) return;

  const roleName = voucherType === 'tham-hoi' ? 'Phụ trách địa bàn' : 'Kế toán';

  await sendWorkflowNotifications(
    leaderIds,
    'sign_request',
    'Chứng từ đã qua bước duyệt đầu',
    `${roleName} ${signerName} đã ký ${voucherLabel} số ${voucherId}. Vui lòng ký duyệt.`,
    voucherId,
    voucherType,
  );
}

export async function notifyCreatorToprint(
  creatorId: string,
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  signerName: string,
) {
  await supabase.rpc('create_workflow_notification', {
    p_user_id: creatorId,
    p_type: 'ready_to_print',
    p_title: 'Chứng từ đã được duyệt hoàn tất',
    p_message: `Lãnh đạo ${signerName} đã ký duyệt ${voucherLabel} số ${voucherId}. Bạn có thể in chứng từ.`,
    p_voucher_id: voucherId,
    p_voucher_type: voucherType,
  });
}

// Legacy aliases
export async function notifySigners(
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  creatorName: string,
  areaName?: string,
) {
  await notifyFirstSigners(voucherId, voucherType, voucherLabel, creatorName, areaName);
}

export async function notifyCreator(
  creatorId: string,
  voucherId: string,
  voucherType: string,
  voucherLabel: string,
  signerName: string,
) {
  await notifyCreatorToprint(creatorId, voucherId, voucherType, voucherLabel, signerName);
}

export async function submitVoucherForSigning(
  voucherId: string,
  voucherType: string,
  voucherData: Record<string, any>,
  createdBy: string,
) {
  await supabase.from('pending_vouchers').insert({
    voucher_id: voucherId,
    voucher_type: voucherType,
    voucher_data: voucherData,
    created_by: createdBy,
    status: 'pending',
  });
}

export async function getSigningStep(
  voucherId: string,
  voucherType: string,
): Promise<'pending' | 'first_signed' | 'fully_signed'> {
  const { data: sigs } = await supabase
    .from('voucher_signatures')
    .select('signer_id')
    .eq('voucher_id', voucherId);

  if (!sigs || sigs.length === 0) return 'pending';

  const signerIdsSet = new Set(sigs.map(s => s.signer_id));

  const leaderIds = await getUserIdsByRole('lanh_dao');
  const leaderSigned = leaderIds.some(id => signerIdsSet.has(id));
  if (leaderSigned) return 'fully_signed';

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
  thu: 'Phiếu thu',
  chi: 'Phiếu chi',
  'tham-hoi': 'Phiếu thăm hỏi',
  'de-nghi': 'Đề nghị thanh toán',
};

export function getVoucherLabel(type: string): string {
  return voucherTypeLabels[type] || type;
}

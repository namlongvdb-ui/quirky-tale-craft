import { supabase } from '@/integrations/supabase/client';
import { Transaction, OrgSettings, YearData } from '@/types/finance';
import {
  getActiveYear,
  getTransactionsForYear,
  saveTransactions,
  addTransaction as addTransactionToStore,
  updateTransaction as updateTransactionInStore,
  deleteTransaction as deleteTransactionFromStore,
  getNextVoucherNo as getNextVoucherNoFromStore,
  getOrgSettings,
  saveOrgSettings,
  getYearDataList,
  closeYear as closeYearInStore,
  setActiveYear,
} from '@/lib/finance-store';
import {
  fetchDirectoryProfiles,
  fetchDirectoryUserRoles,
  fetchSignaturePublicKeys,
  clearDirectoryCache,
} from '@/lib/directory';

/** Kết quả chuẩn hóa cho mọi lời gọi API: { data, error } */
export type ApiResult<T> = { data: T | null; error: { message: string; code?: string } | null };

function ok<T>(data: T): ApiResult<T> {
  return { data, error: null };
}

function fail<T>(err: unknown): ApiResult<T> {
  const message = err instanceof Error ? err.message : String(err || 'Lỗi không xác định');
  const code = (err as { code?: string })?.code;
  return { data: null, error: { message, code } };
}

const YEAR_DATA_KEY = 'union-finance-year-data';

function writeYearDataList(list: YearData[]) {
  localStorage.setItem(YEAR_DATA_KEY, JSON.stringify(list));
}

// ==================== TRANSACTIONS (lưu cục bộ theo năm) ====================
export const transactionsApi = {
  async getAll(year?: number, type?: string): Promise<ApiResult<Transaction[]>> {
    try {
      const targetYear = year ?? getActiveYear();
      let rows = getTransactionsForYear(targetYear);
      if (type) rows = rows.filter(t => t.type === type);
      rows = [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      return ok(rows);
    } catch (err) {
      return fail(err);
    }
  },

  async create(tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<ApiResult<Transaction>> {
    try {
      return ok(addTransactionToStore(tx));
    } catch (err) {
      return fail(err);
    }
  },

  async update(id: string, updates: Partial<Transaction>): Promise<ApiResult<true>> {
    try {
      const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...rest } = updates as Transaction;
      updateTransactionInStore(id, rest);
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },

  async delete(id: string): Promise<ApiResult<true>> {
    try {
      deleteTransactionFromStore(id);
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },

  async getNextVoucherNo(voucherType: string, year?: number): Promise<ApiResult<{ voucherNo: string }>> {
    try {
      if (year && year !== getActiveYear()) {
        // Tính theo năm được chỉ định mà không đổi năm đang làm việc
        const prefixMap: Record<string, string> = { thu: 'PT', chi: 'PC', 'tham-hoi': 'TH', 'de-nghi': 'DN' };
        const prefix = prefixMap[voucherType] || 'CT';
        const count = getTransactionsForYear(year).filter(t => t.type === voucherType).length;
        return ok({ voucherNo: `${prefix}${String(count + 1).padStart(3, '0')}` });
      }
      return ok({ voucherNo: getNextVoucherNoFromStore(voucherType as 'thu' | 'chi' | 'tham-hoi' | 'de-nghi') });
    } catch (err) {
      return fail(err);
    }
  },

  async replaceAll(rows: Transaction[]): Promise<ApiResult<true>> {
    try {
      saveTransactions(rows);
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },
};

// ==================== ORG SETTINGS ====================
export const orgSettingsApi = {
  async get(): Promise<ApiResult<OrgSettings>> {
    try {
      return ok(getOrgSettings());
    } catch (err) {
      return fail(err);
    }
  },

  async save(settings: OrgSettings): Promise<ApiResult<true>> {
    try {
      saveOrgSettings(settings);
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },
};

// ==================== YEAR DATA ====================
export const yearDataApi = {
  async getAll(): Promise<ApiResult<YearData[]>> {
    try {
      return ok(getYearDataList().sort((a, b) => b.year - a.year));
    } catch (err) {
      return fail(err);
    }
  },

  async create(year: number, openingBalance: number): Promise<ApiResult<YearData>> {
    try {
      const list = getYearDataList();
      const idx = list.findIndex(y => y.year === year);
      if (idx >= 0) {
        list[idx] = { ...list[idx], openingBalance };
      } else {
        list.push({ year, openingBalance, closingBalance: 0, isClosed: false });
      }
      writeYearDataList(list);
      return ok(list.find(y => y.year === year) as YearData);
    } catch (err) {
      return fail(err);
    }
  },

  async closeYear(year: number): Promise<ApiResult<{ message: string }>> {
    try {
      const result = closeYearInStore(year);
      if (!result.success) return { data: null, error: { message: result.message } };
      return ok({ message: result.message });
    } catch (err) {
      return fail(err);
    }
  },

  /** Mở lại sổ năm cũ (bỏ trạng thái đã khóa) và chuyển về năm đó. */
  async reopenYear(year: number): Promise<ApiResult<{ message: string }>> {
    try {
      const list = getYearDataList();
      const idx = list.findIndex(y => y.year === year);
      if (idx < 0) return { data: null, error: { message: `Không tìm thấy dữ liệu năm ${year}` } };
      list[idx] = { ...list[idx], isClosed: false, closedAt: undefined };
      writeYearDataList(list);
      setActiveYear(year);
      return ok({ message: `Đã mở lại sổ năm ${year}.` });
    } catch (err) {
      return fail(err);
    }
  },
};

// ==================== PROFILES (danh bạ an toàn) ====================
export type ProfileRow = {
  user_id: string;
  full_name: string;
  username: string | null;
  assigned_area: string | null;
};

export const profilesApi = {
  async getAll(force = false): Promise<ApiResult<ProfileRow[]>> {
    try {
      const data = await fetchDirectoryProfiles(force);
      return ok(data as ProfileRow[]);
    } catch (err) {
      return fail(err);
    }
  },

  async getByUserId(userId: string): Promise<ApiResult<ProfileRow>> {
    try {
      const data = await fetchDirectoryProfiles();
      return ok((data.find(p => p.user_id === userId) as ProfileRow) ?? null);
    } catch (err) {
      return fail(err);
    }
  },

  clearCache: clearDirectoryCache,
};

// ==================== USER ROLES ====================
export const rolesApi = {
  async getAll(force = false) {
    try {
      const data = await fetchDirectoryUserRoles(force);
      return ok(data);
    } catch (err) {
      return fail(err);
    }
  },
};

// ==================== DIGITAL SIGNATURES (chỉ khóa công khai) ====================
export const digitalSignaturesApi = {
  /** Lấy khóa công khai; userId để lọc 1 người, activeOnly để chỉ lấy khóa đang dùng. */
  async get(userId?: string, activeOnly?: boolean) {
    try {
      let data = await fetchSignaturePublicKeys();
      if (activeOnly) data = data.filter(k => k.is_active);
      if (userId) data = data.filter(k => k.user_id === userId);
      return ok(data);
    } catch (err) {
      return fail(err);
    }
  },
};

// ==================== NOTIFICATIONS ====================
export const notificationsApi = {
  async getAll(userId?: string) {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return ok(data || []);
    } catch (err) {
      return fail(err);
    }
  },

  async create(params: {
    userId: string;
    type: string;
    title: string;
    message: string;
    relatedVoucherId?: string;
    relatedVoucherType?: string;
  }) {
    try {
      const { data, error } = await supabase.rpc('create_workflow_notification', {
        p_user_id: params.userId,
        p_type: params.type,
        p_title: params.title,
        p_message: params.message,
        p_voucher_id: params.relatedVoucherId,
        p_voucher_type: params.relatedVoucherType,
      });
      if (error) throw error;
      return ok(data);
    } catch (err) {
      return fail(err);
    }
  },

  async markRead(id: string) {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },

  /** Đánh dấu đã đọc các thông báo của chính mình liên quan tới một chứng từ. */
  async markRelatedRead(params: { relatedVoucherId: string; relatedVoucherType: string; type?: string }) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return ok(true as const);

      let query = supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', uid)
        .eq('related_voucher_id', params.relatedVoucherId)
        .eq('related_voucher_type', params.relatedVoucherType);
      if (params.type) query = query.eq('type', params.type);

      const { error } = await query;
      if (error) throw error;
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },
};

// ==================== PENDING VOUCHERS ====================
export const pendingVouchersApi = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('pending_vouchers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ok(data || []);
    } catch (err) {
      return fail(err);
    }
  },

  async create(params: {
    voucherId: string;
    voucherType: string;
    voucherData: Record<string, unknown>;
    createdBy: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('pending_vouchers')
        .insert({
          voucher_id: params.voucherId,
          voucher_type: params.voucherType,
          voucher_data: params.voucherData as never,
          created_by: params.createdBy,
          status: 'pending',
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return ok(data);
    } catch (err) {
      return fail(err);
    }
  },

  async update(id: string, updates: Record<string, unknown>) {
    try {
      const { error } = await supabase.from('pending_vouchers').update(updates as never).eq('id', id);
      if (error) throw error;
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },

  async remove(id: string) {
    try {
      const { error } = await supabase.from('pending_vouchers').delete().eq('id', id);
      if (error) throw error;
      return ok(true as const);
    } catch (err) {
      return fail(err);
    }
  },
};

// ==================== VOUCHER SIGNATURES ====================
export const voucherSignaturesApi = {
  async get(voucherId: string, voucherType: string, signerId?: string) {
    try {
      let query = supabase
        .from('voucher_signatures')
        .select('*')
        .eq('voucher_id', voucherId)
        .eq('voucher_type', voucherType)
        .order('signed_at', { ascending: true });
      if (signerId) query = query.eq('signer_id', signerId);
      const { data, error } = await query;
      if (error) throw error;
      return ok(data || []);
    } catch (err) {
      return fail(err);
    }
  },

  async create(params: { voucherId: string; voucherType: string; signature: string; dataHash: string }) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Chưa đăng nhập');

      const { data, error } = await supabase
        .from('voucher_signatures')
        .insert({
          voucher_id: params.voucherId,
          voucher_type: params.voucherType,
          signature: params.signature,
          data_hash: params.dataHash,
          signer_id: uid,
        })
        .select()
        .maybeSingle();
      if (error) throw error;
      return ok(data);
    } catch (err) {
      return fail(err);
    }
  },
};

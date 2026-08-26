import { useState, useEffect, useCallback } from 'react';
import { Transaction, OrgSettings, YearData } from '@/types/finance';
import { transactionsApi, orgSettingsApi, yearDataApi } from '@/lib/api-client';
import { saveOrgSettings, saveTransactions } from '@/lib/finance-store';
import { toast } from 'sonner';

const defaultSettings: OrgSettings = {
  orgName: 'CÔNG ĐOÀN NHPT VIỆT NAM',
  orgSubName: 'CÔNG ĐOÀN NHPT CHI NHÁNH KV BẮC ĐÔNG BẮC',
  leaderName: '',
  accountantName: '',
  creatorName: '',
  treasurerName: '',
  unionGroups: [],
  areaRepresentatives: [],
  defaultAccountCode: '',
  openingBalance: 0,
};

function getActiveYearFromStorage(): number {
  const stored = localStorage.getItem('union-finance-active-year');
  if (!stored) return new Date().getFullYear();
  try {
    const parsed = JSON.parse(stored);
    const asNumber = Number(parsed);
    return Number.isFinite(asNumber) ? asNumber : new Date().getFullYear();
  } catch {
    const asNumber = Number(stored);
    return Number.isFinite(asNumber) ? asNumber : new Date().getFullYear();
  }
}

function getOpeningBalanceFallbackFromLocalSettings(): number {
  const raw = localStorage.getItem('union-finance-settings');
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    return Number(parsed?.openingBalance || 0);
  } catch {
    return 0;
  }
}

// ============ ORG SETTINGS ============
export function useOrgSettings() {
  const [settings, setSettings] = useState<OrgSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const normalizeSettings = useCallback((raw: any): OrgSettings => {
    const unionGroupsRaw = Array.isArray(raw?.unionGroups) ? raw.unionGroups : [];
    const areaRepresentativesRaw = Array.isArray(raw?.areaRepresentatives) ? raw.areaRepresentatives : [];

    return {
      ...defaultSettings,
      ...raw,
      openingBalance: Number(raw?.openingBalance ?? defaultSettings.openingBalance) || 0,
      unionGroups: unionGroupsRaw
        .map((g: any) => ({
          name: String(g?.name || '').trim(),
          leaderName: String(g?.leaderName || g?.unionLeaderName || '').trim(),
        }))
        .filter((g: OrgSettings['unionGroups'][number]) => g.name),
      areaRepresentatives: areaRepresentativesRaw
        .map((r: any) => ({
          areaName: String(r?.areaName || '').trim(),
          officerName: String(r?.officerName || '').trim(),
        }))
        .filter((r: OrgSettings['areaRepresentatives'][number]) => r.areaName),
    };
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await orgSettingsApi.get();
    if (data && !error) {
      const normalized = normalizeSettings(data);
      setSettings(normalized);
      // Keep local fallback store in sync for print/export components.
      saveOrgSettings(normalized);
    }
    setLoading(false);
  }, [normalizeSettings]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = useCallback(async (newSettings: OrgSettings) => {
    const normalized = normalizeSettings(newSettings);
    const { error } = await orgSettingsApi.save(normalized);
    if (error) {
      toast.error('Lỗi lưu cài đặt: ' + error.message);
      return false;
    }

    // Keep year_data in sync so CashBook/DetailLedger use the same opening balance.
    const activeYear = getActiveYearFromStorage();
    const { data: yearDataRows } = await yearDataApi.getAll();
    const activeYearData = (yearDataRows || []).find(y => y.year === activeYear);
    if (!activeYearData || !activeYearData.isClosed) {
      await yearDataApi.create(activeYear, normalized.openingBalance);
    }

    setSettings(normalized);
    saveOrgSettings(normalized);
    return true;
  }, [normalizeSettings]);

  return { settings, loading, saveSettings, refetch: fetchSettings };
}

/** Chuẩn hóa bản ghi chứng từ từ API (một số proxy/phiên bản có thể trả snake_case). */
function normalizeTransactionFromApi(raw: Transaction): Transaction {
  const ext = raw as Transaction & { linked_tham_hoi_voucher_no?: string | null };
  const fromCamel = raw.linkedThamHoiVoucherNo != null ? String(raw.linkedThamHoiVoucherNo).trim() : '';
  const fromSnake = ext.linked_tham_hoi_voucher_no != null ? String(ext.linked_tham_hoi_voucher_no).trim() : '';
  const linked = fromCamel || fromSnake || undefined;
  return { ...raw, linkedThamHoiVoucherNo: linked };
}

// ============ TRANSACTIONS ============
export function useTransactions(year?: number, type?: string, refreshKey?: number) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await transactionsApi.getAll(year, type);
    if (data && !error) {
      const normalized = (data as Transaction[]).map(normalizeTransactionFromApi);
      setTransactions(normalized);
      // Only sync to localStorage if we are fetching for the active year and all types
      // (This is a simplified sync for backward compatibility with export functions)
      if (!type) {
        saveTransactions(normalized);
      }
    }
    setLoading(false);
  }, [year, type]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions, refreshKey]);

  const addTransaction = useCallback(async (tx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const { data, error } = await transactionsApi.create(tx);
    if (error) {
      toast.error('Lỗi thêm chứng từ: ' + error.message);
      return null;
    }
    await fetchTransactions();
    return data;
  }, [fetchTransactions]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    const { error } = await transactionsApi.update(id, updates);
    if (error) {
      toast.error('Lỗi cập nhật: ' + error.message);
      return false;
    }
    await fetchTransactions();
    return true;
  }, [fetchTransactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    const { error } = await transactionsApi.delete(id);
    if (error) {
      toast.error('Lỗi xóa: ' + error.message);
      return false;
    }
    await fetchTransactions();
    return true;
  }, [fetchTransactions]);

  const getNextVoucherNo = useCallback(async (voucherType: string) => {
    const { data } = await transactionsApi.getNextVoucherNo(voucherType, year);
    return data?.voucherNo || '';
  }, [year]);

  return {
    transactions, loading, refetch: fetchTransactions,
    addTransaction, updateTransaction, deleteTransaction, getNextVoucherNo,
  };
}

// ============ YEAR DATA ============
export function useYearData(refreshKey?: number) {
  const [yearDataList, setYearDataList] = useState<YearData[]>([]);
  const [activeYear, setActiveYearState] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const fetchYearData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await yearDataApi.getAll();
    if (data && !error) {
      setYearDataList(data);
    }
    // Active year from localStorage (lightweight, no API needed)
    setActiveYearState(getActiveYearFromStorage());
    setLoading(false);
  }, []);

  useEffect(() => { fetchYearData(); }, [fetchYearData, refreshKey]);

  const setActiveYear = useCallback((year: number) => {
    localStorage.setItem('union-finance-active-year', JSON.stringify(year));
    setActiveYearState(year);
  }, []);

  const closeYear = useCallback(async (year: number) => {
    const { data, error } = await yearDataApi.closeYear(year);
    if (error) {
      toast.error('Lỗi khóa sổ: ' + error.message);
      return { success: false, message: error.message };
    }
    await fetchYearData();
    return { success: true, message: data?.message || 'Khóa sổ thành công' };
  }, [fetchYearData]);

  const reopenYear = useCallback(async (year: number) => {
    const { data, error } = await yearDataApi.reopenYear(year);
    if (error) {
      toast.error('Lỗi mở lại sổ: ' + error.message);
      return { success: false, message: error.message };
    }
    await fetchYearData();
    return { success: true, message: data?.message || 'Mở lại sổ thành công' };
  }, [fetchYearData]);

  const isYearClosed = useCallback((year: number) => {
    const yd = yearDataList.find(y => y.year === year);
    return yd?.isClosed ?? false;
  }, [yearDataList]);

  const getOpeningBalanceForYear = useCallback((year: number) => {
    const yd = yearDataList.find(y => y.year === year);
    if (yd) return Number(yd.openingBalance) || 0;
    return getOpeningBalanceFallbackFromLocalSettings();
  }, [yearDataList]);

  const availableYears = yearDataList.map(y => y.year).sort((a, b) => b - a);
  if (!availableYears.includes(activeYear)) availableYears.unshift(activeYear);

  return {
    yearDataList, activeYear, setActiveYear, loading,
    closeYear, reopenYear, isYearClosed, getOpeningBalanceForYear, availableYears,
    refetch: fetchYearData,
  };
}

import { Transaction, OrgSettings, YearData } from '@/types/finance';

const STORAGE_KEY = 'union-finance-transactions';
const BALANCE_KEY = 'union-finance-opening-balance';
const SETTINGS_KEY = 'union-finance-settings';
const ACTIVE_YEAR_KEY = 'union-finance-active-year';
const YEAR_DATA_KEY = 'union-finance-year-data';

const defaultSettings: OrgSettings = {
  orgName: 'CÔNG ĐOÀN NHPT VIỆT NAM',
  orgSubName: 'CÔNG ĐOÀN NHPT CHI NHÁNH KV BẮC ĐÔNG BẮC',
  leaderName: 'Phí Quang Chiến',
  accountantName: 'Lê Thị Thu Hương',
  creatorName: 'Lê Thị Thu Hương',
  treasurerName: 'Nguyễn Thị Yên',
  unionGroups: [
    { 
      name: 'Tổ CĐ BP Kế toán – Hành chính, PGD Cao Bằng', 
      leaderName: 'Trần Nam Long'
    },
  ],
  areaRepresentatives: [],
  defaultAccountCode: '',
  openingBalance: 0,
};

// ======================== YEAR MANAGEMENT ========================

export function getActiveYear(): number {
  const stored = localStorage.getItem(ACTIVE_YEAR_KEY);
  if (stored) return parseInt(stored, 10);
  return new Date().getFullYear();
}

export function setActiveYear(year: number) {
  localStorage.setItem(ACTIVE_YEAR_KEY, JSON.stringify(year));
}

export function getYearDataList(): YearData[] {
  const stored = localStorage.getItem(YEAR_DATA_KEY);
  if (stored) return JSON.parse(stored);
  // Initialize with current year
  const currentYear = new Date().getFullYear();
  const initial: YearData[] = [{
    year: currentYear,
    openingBalance: getOrgSettings().openingBalance,
    closingBalance: 0,
    isClosed: false,
  }];
  localStorage.setItem(YEAR_DATA_KEY, JSON.stringify(initial));
  return initial;
}

function saveYearDataList(data: YearData[]) {
  localStorage.setItem(YEAR_DATA_KEY, JSON.stringify(data));
}

export function getYearData(year: number): YearData | undefined {
  return getYearDataList().find(y => y.year === year);
}

export function getAvailableYears(): number[] {
  const yearDataList = getYearDataList();
  const years = yearDataList.map(y => y.year);
  const activeYear = getActiveYear();
  if (!years.includes(activeYear)) years.push(activeYear);
  return years.sort((a, b) => b - a);
}

/** Get the opening balance for a specific year */
export function getOpeningBalanceForYear(year: number): number {
  const yd = getYearData(year);
  if (yd) return yd.openingBalance;
  return getOrgSettings().openingBalance;
}

/** Calculate closing balance for a year */
export function calculateClosingBalance(year: number): number {
  const txs = getTransactionsForYear(year);
  const opening = getOpeningBalanceForYear(year);
  const totalThu = txs.filter(t => t.type === 'thu').reduce((s, t) => s + t.amount, 0);
  const totalChi = txs.filter(t => t.type === 'chi').reduce((s, t) => s + t.amount, 0);
  return opening + totalThu - totalChi;
}

/** Close the year and carry forward to next year */
export function closeYear(year: number): { success: boolean; message: string } {
  const yearDataList = getYearDataList();
  const existingIdx = yearDataList.findIndex(y => y.year === year);
  
  if (existingIdx >= 0 && yearDataList[existingIdx].isClosed) {
    return { success: false, message: `Năm ${year} đã được khóa sổ trước đó.` };
  }

  const closingBalance = calculateClosingBalance(year);
  const nextYear = year + 1;

  // Update or create current year data
  if (existingIdx >= 0) {
    yearDataList[existingIdx].closingBalance = closingBalance;
    yearDataList[existingIdx].isClosed = true;
    yearDataList[existingIdx].closedAt = new Date().toISOString();
  } else {
    yearDataList.push({
      year,
      openingBalance: getOrgSettings().openingBalance,
      closingBalance,
      isClosed: true,
      closedAt: new Date().toISOString(),
    });
  }

  // Create next year data if it doesn't exist
  const nextIdx = yearDataList.findIndex(y => y.year === nextYear);
  if (nextIdx < 0) {
    yearDataList.push({
      year: nextYear,
      openingBalance: closingBalance,
      closingBalance: 0,
      isClosed: false,
    });
  } else {
    yearDataList[nextIdx].openingBalance = closingBalance;
  }

  saveYearDataList(yearDataList);

  // Switch to new year
  setActiveYear(nextYear);

  return { success: true, message: `Đã khóa sổ năm ${year}. Số dư cuối kỳ ${closingBalance.toLocaleString('vi-VN')} đ được kết chuyển sang năm ${nextYear}.` };
}

/** Reopen a closed year for viewing */
export function reopenYear(year: number) {
  setActiveYear(year);
}

/** Admin only: unlock a previously closed year so chứng từ can be edited again */
export function unlockYear(year: number): { success: boolean; message: string } {
  const yearDataList = getYearDataList();
  const idx = yearDataList.findIndex(y => y.year === year);
  if (idx < 0) {
    return { success: false, message: `Không tìm thấy dữ liệu năm ${year}.` };
  }
  if (!yearDataList[idx].isClosed) {
    return { success: false, message: `Năm ${year} hiện đang mở.` };
  }
  yearDataList[idx].isClosed = false;
  yearDataList[idx].closedAt = undefined;
  saveYearDataList(yearDataList);
  setActiveYear(year);
  return { success: true, message: `Đã mở lại sổ năm ${year}. Bạn có thể chỉnh sửa chứng từ.` };
}

/** Check if a year is closed (read-only) */
export function isYearClosed(year: number): boolean {
  const yd = getYearData(year);
  return yd?.isClosed ?? false;
}

// ======================== SETTINGS ========================

export function getOrgSettings(): OrgSettings {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.unionGroups && parsed.unionGroups.length > 0) {
      parsed.unionGroups = parsed.unionGroups.map((g: any) => ({
        name: g.name,
        leaderName: g.leaderName || g.unionLeaderName || ''
      }));
    }
    return { ...defaultSettings, ...parsed };
  }
  return defaultSettings;
}

export function saveOrgSettings(settings: OrgSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  // Also update year data opening balance for active year if not closed
  const activeYear = getActiveYear();
  const yearDataList = getYearDataList();
  const idx = yearDataList.findIndex(y => y.year === activeYear);
  if (idx >= 0 && !yearDataList[idx].isClosed) {
    yearDataList[idx].openingBalance = settings.openingBalance;
    saveYearDataList(yearDataList);
  }
  setOpeningBalance(settings.openingBalance);
}

export function getOpeningBalance(): number {
  const activeYear = getActiveYear();
  return getOpeningBalanceForYear(activeYear);
}

export function setOpeningBalance(balance: number) {
  localStorage.setItem(BALANCE_KEY, JSON.stringify(balance));
}

// ======================== TRANSACTIONS ========================

function getStorageKeyForYear(year: number): string {
  return `${STORAGE_KEY}-${year}`;
}

/** Get all transactions (for backward compatibility, migrates old data) */
export function getTransactions(): Transaction[] {
  const activeYear = getActiveYear();
  return getTransactionsForYear(activeYear);
}

/** Get transactions for a specific year */
export function getTransactionsForYear(year: number): Transaction[] {
  const key = getStorageKeyForYear(year);
  const stored = localStorage.getItem(key);
  if (stored) return JSON.parse(stored);
  
  // Migration: check old key for current year data
  const oldStored = localStorage.getItem(STORAGE_KEY);
  if (oldStored) {
    const allTxs: Transaction[] = JSON.parse(oldStored);
    // Distribute transactions by year based on date
    const yearMap: Record<number, Transaction[]> = {};
    for (const tx of allTxs) {
      const txYear = new Date(tx.date).getFullYear();
      if (!yearMap[txYear]) yearMap[txYear] = [];
      yearMap[txYear].push(tx);
    }
    // Save each year's transactions
    for (const [y, txs] of Object.entries(yearMap)) {
      localStorage.setItem(getStorageKeyForYear(parseInt(y)), JSON.stringify(txs));
    }
    // Remove old key
    localStorage.removeItem(STORAGE_KEY);
    return yearMap[year] || [];
  }
  
  return [];
}

export function saveTransactions(transactions: Transaction[]) {
  const activeYear = getActiveYear();
  localStorage.setItem(getStorageKeyForYear(activeYear), JSON.stringify(transactions));
}

export function addTransaction(tx: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
  const activeYear = getActiveYear();
  if (isYearClosed(activeYear)) {
    throw new Error(`Năm ${activeYear} đã khóa sổ. Không thể thêm chứng từ.`);
  }
  const transactions = getTransactions();
  const newTx: Transaction = {
    ...tx,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  transactions.push(newTx);
  saveTransactions(transactions);
  return newTx;
}

export function deleteTransaction(id: string) {
  const activeYear = getActiveYear();
  if (isYearClosed(activeYear)) {
    throw new Error(`Năm ${activeYear} đã khóa sổ. Không thể xóa chứng từ.`);
  }
  const transactions = getTransactions().filter(t => t.id !== id);
  saveTransactions(transactions);
}

export function updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>) {
  const activeYear = getActiveYear();
  if (isYearClosed(activeYear)) {
    throw new Error(`Năm ${activeYear} đã khóa sổ. Không thể sửa chứng từ.`);
  }
  const transactions = getTransactions().map(t =>
    t.id === id ? { ...t, ...updates } : t
  );
  saveTransactions(transactions);
}

/** Get next voucher number - resets per year */
export function getNextVoucherNo(type: 'thu' | 'chi' | 'tham-hoi' | 'de-nghi'): string {
  const transactions = getTransactions();
  const prefixMap = { thu: 'PT', chi: 'PC', 'tham-hoi': 'TH', 'de-nghi': 'DN' };
  const prefix = prefixMap[type];
  const existing = transactions.filter(t => t.type === type);
  const nextNum = existing.length + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// ======================== UTILITIES ========================

export function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const groups = ['', 'nghìn', 'triệu', 'tỷ'];

  function readThreeDigits(n: number): string {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    let result = '';
    if (h > 0) result += units[h] + ' trăm ';
    if (t > 1) result += units[t] + ' mươi ';
    else if (t === 1) result += 'mười ';
    else if (t === 0 && h > 0 && u > 0) result += 'lẻ ';
    if (u > 0) {
      if (t > 1 && u === 1) result += 'mốt';
      else if (t >= 1 && u === 5) result += 'lăm';
      else result += units[u];
    }
    return result.trim();
  }

  const parts: string[] = [];
  let remaining = num;
  let groupIdx = 0;
  while (remaining > 0) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      parts.unshift(readThreeDigits(chunk) + ' ' + groups[groupIdx]);
    }
    remaining = Math.floor(remaining / 1000);
    groupIdx++;
  }

  const text = parts.join(' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1) + ' đồng';
}

import { StaffMember, StaffSettings, TransferRecord } from '@/types/finance';
import { queueCloudSave } from '@/lib/cloud-sync';

const STAFF_KEY = 'union-finance-staff';
const STAFF_SETTINGS_KEY = 'union-finance-staff-settings';
const TRANSFER_HISTORY_KEY = 'union-finance-transfer-history';

const defaultStaffSettings: StaffSettings = {
  baseSalary: 2340000,
};

export function getStaffSettings(): StaffSettings {
  const stored = localStorage.getItem(STAFF_SETTINGS_KEY);
  return stored ? { ...defaultStaffSettings, ...JSON.parse(stored) } : defaultStaffSettings;
}

export function saveStaffSettings(settings: StaffSettings) {
  localStorage.setItem(STAFF_SETTINGS_KEY, JSON.stringify(settings));
}

export function getStaffList(): StaffMember[] {
  const stored = localStorage.getItem(STAFF_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveStaffList(list: StaffMember[]) {
  localStorage.setItem(STAFF_KEY, JSON.stringify(list));
}

export function addStaff(staff: Omit<StaffMember, 'id'>): StaffMember {
  const list = getStaffList();
  const newStaff: StaffMember = { ...staff, id: crypto.randomUUID() };
  list.push(newStaff);
  saveStaffList(list);
  return newStaff;
}

export function updateStaff(id: string, updates: Partial<Omit<StaffMember, 'id'>>) {
  const list = getStaffList().map(s => s.id === id ? { ...s, ...updates } : s);
  saveStaffList(list);
}

export function deleteStaff(id: string) {
  saveStaffList(getStaffList().filter(s => s.id !== id));
}

export function getTransferHistory(): TransferRecord[] {
  const stored = localStorage.getItem(TRANSFER_HISTORY_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function addTransferRecord(record: Omit<TransferRecord, 'id'>): TransferRecord {
  const history = getTransferHistory();
  const newRecord: TransferRecord = { ...record, id: crypto.randomUUID() };
  history.unshift(newRecord);
  localStorage.setItem(TRANSFER_HISTORY_KEY, JSON.stringify(history));
  return newRecord;
}

export function calculateInsuranceSalary(
  salaryCoefficient: number,
  positionCoefficient: number,
  regionalSalary: number,
  baseSalary: number
): number {
  return (salaryCoefficient * regionalSalary) + (positionCoefficient * baseSalary);
}

export function calculateUnionFee(insuranceSalary: number, baseSalary: number): number {
  const fee = insuranceSalary * 0.005;
  const cap = baseSalary * 0.10;
  return Math.min(fee, cap);
}

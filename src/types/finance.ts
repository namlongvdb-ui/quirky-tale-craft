export interface Transaction {
  id: string;
  date: string;
  voucherNo: string;
  type: 'thu' | 'chi' | 'tham-hoi' | 'de-nghi';
  amount: number;
  description: string;
  personName: string;
  department: string;
  accountCode: string;
  approver: string;
  attachments: number;
  createdAt: string;
  createdBy?: string; // user ID of creator
  // Extra fields for tham-hoi
  recipientName?: string;
  reason?: string;
  // Extra fields for de-nghi
  bankAccount?: string;
  bankAccountName?: string;
  bankName?: string;
  linkedThamHoiVoucherNo?: string;
  times?: string;
}

export interface CashBookEntry {
  date: string;
  voucherNo: string;
  description: string;
  thu: number;
  chi: number;
  balance: number;
}

export interface DetailLedgerEntry extends Transaction {
  runningBalance: number;
}

export type ViewType = 'dashboard' | 'phieu-thu' | 'phieu-chi' | 'phieu-tham-hoi' | 'de-nghi-thanh-toan' | 'so-quy' | 'so-chi-tiet' | 'danh-sach-can-bo' | 'khoa-so' | 'cai-dat' | 'quan-tri' | 'doi-mat-khau' | 'lich-su-ky' | 'cho-ky' | 'da-duyet' | 'bao-cao-de-nghi-tham-hoi';

export interface YearData {
  year: number;
  openingBalance: number;
  closingBalance: number;
  isClosed: boolean;
  closedAt?: string;
}

export interface StaffMember {
  id: string;
  fullName: string;
  department: string;
  position: string;
  birthDate: string;
  gender: 'nam' | 'nu';
  salaryCoefficient: number;
  positionCoefficient: number;
  regionalSalary: number; // Lương vùng riêng từng đoàn viên
}

export interface TransferRecord {
  id: string;
  staffId: string;
  staffName: string;
  fromDepartment: string;
  toDepartment: string;
  type: 'move' | 'out';
  date: string;
  note?: string;
}

export interface StaffSettings {
  minimumSalary?: number; // Deprecated
  baseSalary: number; // Lương cơ sở
}

export interface OrgSettings {
  orgName: string;
  orgSubName: string;
  leaderName: string;
  accountantName: string;
  creatorName: string;
  treasurerName: string;
  unionGroups: { name: string; leaderName: string }[];
  areaRepresentatives: { areaName: string; officerName: string }[];
  defaultAccountCode: string;
  openingBalance: number;
}
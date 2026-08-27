import { useCallback, useEffect, useState } from 'react';
import { StaffMember, StaffSettings, TransferRecord } from '@/types/finance';
import {
  getStaffList,
  saveStaffList,
  getStaffSettings,
  saveStaffSettings,
  addStaff as addStaffToStore,
  updateStaff as updateStaffInStore,
  deleteStaff as deleteStaffFromStore,
  getTransferHistory,
  addTransferRecord as addTransferRecordToStore,
} from '@/lib/staff-store';

/** Danh sách đoàn viên (lưu cục bộ) kèm các thao tác thêm/sửa/xóa. */
export function useStaffList(refreshKey?: number) {
  const [list, setList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setList(getStaffList());
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload, refreshKey]);

  const addStaff = useCallback((staff: Omit<StaffMember, 'id'>) => {
    const created = addStaffToStore(staff);
    reload();
    return created;
  }, [reload]);

  const updateStaff = useCallback((id: string, updates: Partial<Omit<StaffMember, 'id'>>) => {
    updateStaffInStore(id, updates);
    reload();
  }, [reload]);

  const deleteStaff = useCallback((id: string) => {
    deleteStaffFromStore(id);
    reload();
  }, [reload]);

  const replaceList = useCallback((next: StaffMember[]) => {
    saveStaffList(next);
    reload();
  }, [reload]);

  return { list, loading, reload, refetch: reload, addStaff, updateStaff, deleteStaff, replaceList };
}

/** Cài đặt lương cơ sở dùng để tính đoàn phí. */
export function useStaffSettings(refreshKey?: number) {
  const [settings, setSettings] = useState<StaffSettings>(getStaffSettings());

  const reload = useCallback(() => {
    setSettings(getStaffSettings());
  }, []);

  useEffect(() => { reload(); }, [reload, refreshKey]);

  const saveSettings = useCallback((next: StaffSettings) => {
    saveStaffSettings(next);
    reload();
    return true;
  }, [reload]);

  return { settings, saveSettings, reload, refetch: reload };
}

/** Lịch sử điều chuyển đoàn viên. */
export function useTransferHistory(refreshKey?: number) {
  const [history, setHistory] = useState<TransferRecord[]>([]);

  const reload = useCallback(() => {
    setHistory(getTransferHistory());
  }, []);

  useEffect(() => { reload(); }, [reload, refreshKey]);

  const addRecord = useCallback((record: Omit<TransferRecord, 'id'>) => {
    const created = addTransferRecordToStore(record);
    reload();
    return created;
  }, [reload]);

  return { history, reload, refetch: reload, addRecord };
}

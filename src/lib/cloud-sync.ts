import { supabase } from '@/integrations/supabase/client';

/**
 * Đồng bộ dữ liệu giữa máy người dùng (localStorage) và kho dữ liệu chung trên đám mây.
 *
 * Cách hoạt động:
 * - Mỗi lần chương trình lưu dữ liệu (phiếu, đoàn viên, cài đặt...), bản sao được đẩy lên đám mây.
 * - Khi đăng nhập: dữ liệu trên đám mây được tải về máy; dữ liệu cũ trên máy mà đám mây chưa có
 *   sẽ được đẩy lên đám mây (di chuyển dữ liệu cũ một lần).
 * - Định kỳ tải dữ liệu mới nhất từ đám mây để các máy luôn đồng bộ với nhau.
 */

const APP_DATA_TABLE = 'app_data';
export const APP_DATA_SYNCED_EVENT = 'app-data-synced';

const STATIC_SYNC_KEYS = [
  'union-finance-active-year',
  'union-finance-year-data',
  'union-finance-settings',
  'union-finance-opening-balance',
  'union-finance-staff',
  'union-finance-staff-settings',
  'union-finance-transfer-history',
];
const TX_PREFIX = 'union-finance-transactions-';
const LEGACY_TX_KEY = 'union-finance-transactions';

function isSyncedKey(key: string): boolean {
  if (key === LEGACY_TX_KEY) return false;
  return STATIC_SYNC_KEYS.includes(key) || key.startsWith(TX_PREFIX);
}

// ============ Đẩy dữ liệu lên đám mây (gom nhóm, trì hoãn nhẹ) ============

const pending = new Map<string, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let pullInFlight = false;

export function queueCloudSave(key: string, value: unknown) {
  if (!isSyncedKey(key)) return;
  pending.set(key, value);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushPendingSaves, 1000);
}

function flushPendingSaves() {
  flushTimer = null;
  if (pending.size === 0) return;
  const batch = Array.from(pending.entries());
  pending.clear();
  void pushRows(batch);
}

async function pushRows(rows: [string, unknown][]) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Chưa đăng nhập: giữ lại để đẩy khi đăng nhập xong
      for (const [id, data] of rows) pending.set(id, data);
      if (!flushTimer) flushTimer = setTimeout(flushPendingSaves, 10_000);
      return;
    }
    const payload = rows.map(([id, data]) => ({ id, data: data as never, updated_by: user.id }));
    const { error } = await supabase
      .from(APP_DATA_TABLE)
      .upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Đồng bộ dữ liệu lên kho chung chưa thành công, sẽ thử lại:', error.message);
      for (const [id, data] of rows) pending.set(id, data);
      if (!flushTimer) flushTimer = setTimeout(flushPendingSaves, 10_000);
    }
  } catch (err) {
    console.warn('Đồng bộ dữ liệu lên kho chung chưa thành công, sẽ thử lại:', err);
    for (const [id, data] of rows) pending.set(id, data);
    if (!flushTimer) flushTimer = setTimeout(flushPendingSaves, 10_000);
  }
}

// ============ Tải dữ liệu từ đám mây về máy ============

async function fetchCloudRows(): Promise<Record<string, unknown> | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase.from(APP_DATA_TABLE).select('id, data');
    if (error) {
      console.warn('Không tải được dữ liệu từ kho chung:', error.message);
      return null;
    }
    const map: Record<string, unknown> = {};
    for (const row of data || []) {
      if (row && typeof (row as { id?: unknown }).id === 'string' && isSyncedKey((row as { id: string }).id)) {
        map[(row as { id: string }).id] = (row as { data: unknown }).data;
      }
    }
    return map;
  } catch (err) {
    console.warn('Không tải được dữ liệu từ kho chung:', err);
    return null;
  }
}

function applyCloudRows(cloud: Record<string, unknown>): boolean {
  let changed = false;
  for (const [id, value] of Object.entries(cloud)) {
    const serialized = JSON.stringify(value ?? null);
    if (localStorage.getItem(id) !== serialized) {
      localStorage.setItem(id, serialized);
      changed = true;
    }
  }
  return changed;
}

// ============ Đồng bộ lần đầu sau khi đăng nhập ============

let initialSyncStarted = false;
let refreshLoopStarted = false;

export async function runInitialCloudSync(): Promise<void> {
  if (initialSyncStarted) return;
  initialSyncStarted = true;
  pullInFlight = true;
  try {
    const cloud = await fetchCloudRows();
    if (cloud === null) {
      initialSyncStarted = false; // chưa đăng nhập hoặc mất mạng — thử lại ở lần sau
      return;
    }

    // 1. Đẩy dữ liệu cũ trên máy lên đám mây (chỉ những mục đám mây chưa có)
    const localKeys = new Set<string>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSyncedKey(k)) localKeys.add(k);
    }
    const cloudIds = new Set(Object.keys(cloud));
    const toPush: [string, unknown][] = [];
    for (const k of localKeys) {
      if (cloudIds.has(k)) continue;
      try {
        toPush.push([k, JSON.parse(localStorage.getItem(k) as string)]);
      } catch {
        // bỏ qua dữ liệu hỏng trên máy
      }
    }
    if (toPush.length > 0) await pushRows(toPush);

    // 2. Đưa dữ liệu mới nhất từ đám mây về máy
    const changed = applyCloudRows(cloud);
    if (changed) window.dispatchEvent(new CustomEvent(APP_DATA_SYNCED_EVENT));
  } finally {
    pullInFlight = false;
  }
}

// ============ Tải lại định kỳ để các máy luôn đồng bộ ============

export function startCloudRefreshLoop() {
  if (refreshLoopStarted) return;
  refreshLoopStarted = true;

  const tick = () => {
    if (pullInFlight || pending.size > 0) return;
    void (async () => {
      const cloud = await fetchCloudRows();
      if (!cloud) return;
      pullInFlight = true;
      try {
        if (applyCloudRows(cloud)) window.dispatchEvent(new CustomEvent(APP_DATA_SYNCED_EVENT));
      } finally {
        pullInFlight = false;
      }
    })();
  };

  setInterval(tick, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

/** Đặt lại trạng thái đồng bộ (dùng khi đăng xuất). */
export function resetCloudSyncState() {
  initialSyncStarted = false;
  pending.clear();
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

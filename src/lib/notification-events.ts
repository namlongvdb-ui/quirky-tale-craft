const NOTIFICATIONS_REFRESH_EVENT = 'union-finance:notifications-refresh';

/** Thông báo cho các component (ví dụ NotificationBell) tải lại danh sách thông báo. */
export function emitNotificationsRefresh() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT));
}

/** Đăng ký lắng nghe sự kiện làm mới thông báo. Trả về hàm hủy đăng ký. */
export function onNotificationsRefresh(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(NOTIFICATIONS_REFRESH_EVENT, listener);
  return () => window.removeEventListener(NOTIFICATIONS_REFRESH_EVENT, listener);
}

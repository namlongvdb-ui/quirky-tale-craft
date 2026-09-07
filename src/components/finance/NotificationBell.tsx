import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getVoucherLabel } from '@/lib/notification-utils';
import { onNotificationsRefresh } from '@/lib/notification-events';
import { format } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_voucher_id: string | null;
  related_voucher_type: string | null;
  is_read: boolean;
  created_at: string;
  voucher_status?: string;
}

interface NotificationBellProps {
  onNavigate: (view: 'cho-ky' | 'da-duyet') => void;
}

const voucherStatusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  partially_signed: { label: 'Đã ký 1 bước', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  signed: { label: 'Đã duyệt xong', className: 'bg-green-100 text-green-700 border-green-300' },
  printed: { label: 'Đã in', className: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  unknown: { label: '', className: '' },
};

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!data) return;

    // Enrich notifications with current voucher status
    const voucherIds = [...new Set(
      data.filter(n => n.related_voucher_id).map(n => n.related_voucher_id!)
    )];

    let statusMap = new Map<string, string>();
    if (voucherIds.length > 0) {
      const { data: vouchers } = await supabase
        .from('pending_vouchers')
        .select('voucher_id, status')
        .in('voucher_id', voucherIds);
      
      if (vouchers) {
        vouchers.forEach(v => statusMap.set(v.voucher_id, v.status));
      }
    }

    const enriched: Notification[] = data.map(n => ({
      ...n,
      voucher_status: n.related_voucher_id
        ? statusMap.get(n.related_voucher_id) || 'unknown'
        : undefined,
    }));

    setNotifications(enriched);
  }, [user]);

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Listen to new/changed notifications
    const channel = supabase
      .channel('notifications-' + user.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    // Listen to pending_vouchers status changes (signed, printed, etc.)
    const voucherChannel = supabase
      .channel('voucher-status-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pending_vouchers',
        },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_vouchers',
        },
        () => fetchNotifications()
      )
      .subscribe();

    // Listen to voucher_signatures changes (new signatures affect status)
    const sigChannel = supabase
      .channel('voucher-sigs-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voucher_signatures',
        },
        () => fetchNotifications()
      )
      .subscribe();

    // Làm mới ngay khi luồng ký phát sự kiện (không phụ thuộc realtime)
    const offRefresh = onNotificationsRefresh(() => {
      fetchNotifications();
    });

    return () => {
      offRefresh();
      supabase.removeChannel(channel);
      supabase.removeChannel(voucherChannel);
      supabase.removeChannel(sigChannel);
    };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClickNotification = (n: Notification) => {
    markAsRead(n.id);
    setOpen(false);
    // Navigate based on current voucher status, not just notification type
    if (n.voucher_status === 'signed' || n.voucher_status === 'printed') {
      onNavigate('da-duyet');
    } else if (n.type === 'sign_request') {
      onNavigate('cho-ky');
    } else if (n.type === 'signed' || n.type === 'ready_to_print') {
      onNavigate('da-duyet');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-white/10 transition-colors">
          <Bell className="h-5 w-5 text-blue-200" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-[10px] font-bold text-white animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start" side="right">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Thông báo</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Chưa có thông báo</div>
          ) : (
            notifications.map(n => {
              const statusInfo = n.voucher_status ? voucherStatusLabels[n.voucher_status] : null;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClickNotification(n)}
                  className={`w-full text-left px-4 py-3 border-b last:border-0 transition-colors hover:bg-accent ${!n.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!n.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(n.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                        {statusInfo && statusInfo.label && (
                          <Badge variant="outline" className={`text-[10px] ${statusInfo.className}`}>
                            {statusInfo.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {n.related_voucher_type && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {getVoucherLabel(n.related_voucher_type)}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
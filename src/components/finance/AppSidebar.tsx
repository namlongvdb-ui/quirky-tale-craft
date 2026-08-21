import { ViewType } from '@/types/finance';
import {
  LayoutDashboard, FileInput, FileOutput, Heart, FileText, BookOpen, ClipboardList,
  Users, Settings, BookOpenCheck, Shield, LogOut, KeyRound, History, PenTool, FileCheck, BookMarked,
} from 'lucide-react';
import { getActiveYear, isYearClosed } from '@/lib/finance-store';
import { useAuth } from '@/hooks/useAuth';

interface AppSidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  refreshKey?: number;
  notificationBell?: React.ReactNode;
}

type Item = { view: ViewType; label: string; icon: React.ElementType; adminOnly?: boolean };

const groups: { label?: string; items: Item[] }[] = [
  {
    items: [
      { view: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { view: 'cho-ky', label: 'Chứng từ chờ ký', icon: PenTool },
      { view: 'da-duyet', label: 'Chứng từ đã duyệt', icon: FileCheck },
      { view: 'lich-su-ky', label: 'Lịch sử ký duyệt', icon: History },
    ],
  },
  {
    items: [
      { view: 'phieu-tham-hoi', label: 'Phiếu Thăm Hỏi', icon: Heart },
      { view: 'de-nghi-thanh-toan', label: 'Đề Nghị Thanh Toán', icon: FileText },
      { view: 'phieu-thu', label: 'Phiếu Thu', icon: FileInput },
      { view: 'phieu-chi', label: 'Phiếu Chi', icon: FileOutput },
    ],
  },
  {
    items: [
      { view: 'so-quy', label: 'Sổ Quỹ', icon: BookOpen },
      { view: 'so-chi-tiet', label: 'Sổ Chi Tiết', icon: ClipboardList },
    ],
  },
  {
    items: [
      { view: 'danh-sach-can-bo', label: 'Danh Sách Đoàn Viên', icon: Users },
      { view: 'khoa-so', label: 'Khóa Sổ & Kết Chuyển', icon: BookOpenCheck },
      { view: 'cai-dat', label: 'Cài đặt', icon: Settings },
      { view: 'doi-mat-khau', label: 'Đổi mật khẩu', icon: KeyRound },
      { view: 'quan-tri', label: 'Quản trị hệ thống', icon: Shield, adminOnly: true },
    ],
  },
];

function initials(name?: string) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(-2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

export function AppSidebar({ currentView, onViewChange, notificationBell }: AppSidebarProps) {
  const activeYear = getActiveYear();
  const closed = isYearClosed(activeYear);
  const { isAdmin, profile, signOut } = useAuth();

  return (
    <aside className="w-64 shrink-0 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col no-print">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-card">
          <BookMarked className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-[15px] font-bold leading-tight text-foreground uppercase tracking-wide">
            Quản lý tài chính
          </h1>
          <p className="label-caps mt-0.5">Công đoàn cơ sở</p>
        </div>
      </div>

      {/* Year status */}
      <div className="px-4">
        <div className="rounded-xl bg-muted/70 px-3 py-2 flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${closed ? 'bg-destructive' : 'bg-success'}`} />
          <span className="label-caps text-foreground/70">
            Niên độ {activeYear}{closed ? ' · Đã khóa' : ''}
          </span>
        </div>
      </div>

      {/* User */}
      {profile && (
        <div className="px-4 mt-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary-soft text-accent-foreground flex items-center justify-center text-xs font-bold">
            {initials(profile.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{profile.full_name}</p>
            <p className="text-xs text-muted-foreground truncate">@{profile.username}</p>
          </div>
          {notificationBell}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 mt-5 pb-4 space-y-4">
        {groups.map((group, gi) => {
          const items = group.items.filter(i => !i.adminOnly || isAdmin);
          if (!items.length) return null;
          return (
            <div
              key={gi}
              className={gi > 0 ? 'pt-4 border-t border-sidebar-border/70 space-y-1' : 'space-y-1'}
            >
              {items.map(item => {
                const active = currentView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => onViewChange(item.view)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground font-semibold shadow-card'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${active ? '' : 'text-muted-foreground'}`} />
                    <span className="font-display text-[13px] tracking-wide">{item.label}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-2">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>

      <div className="border-t border-sidebar-border py-2 overflow-hidden">
        <div className="text-[10px] text-muted-foreground whitespace-nowrap animate-marquee">
          Copyright by Trần Nam Long VDB-Chi nhánh KV Bắc Đông Bắc, PGD Cao Bằng
        </div>
      </div>
    </aside>
  );
}

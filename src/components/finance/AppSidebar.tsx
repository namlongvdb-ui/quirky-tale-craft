import { ViewType } from '@/types/finance';
import { LayoutDashboard, FileInput, FileOutput, Heart, FileText, BookOpen, ClipboardList, Users, Settings, BookOpenCheck, Shield, LogOut, KeyRound, History, PenTool, FileCheck, Link2 } from 'lucide-react';
import { getActiveYear, isYearClosed } from '@/lib/finance-store';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  refreshKey?: number;
  notificationBell?: React.ReactNode;
}

const menuItems: { view: ViewType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { view: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { view: 'cho-ky', label: 'Chứng từ chờ ký', icon: PenTool },
  { view: 'da-duyet', label: 'Chứng từ đã duyệt', icon: FileCheck },
  { view: 'lich-su-ky', label: 'Lịch sử ký duyệt', icon: History },
  { view: 'bao-cao-de-nghi-tham-hoi', label: 'Theo dõi thăm hỏi đoàn viên', icon: Link2 },
  { view: 'phieu-tham-hoi', label: 'Phiếu Thăm Hỏi', icon: Heart },
  { view: 'de-nghi-thanh-toan', label: 'Đề Nghị Thanh Toán', icon: FileText },
  { view: 'phieu-thu', label: 'Phiếu Thu', icon: FileInput },
  { view: 'phieu-chi', label: 'Phiếu Chi', icon: FileOutput },
  { view: 'so-quy', label: 'Sổ Quỹ', icon: BookOpen },
  { view: 'so-chi-tiet', label: 'Sổ Chi Tiết', icon: ClipboardList },
  { view: 'danh-sach-can-bo', label: 'Danh Sách Đoàn Viên', icon: Users },
  { view: 'khoa-so', label: 'Khóa Sổ & Kết Chuyển', icon: BookOpenCheck },
  { view: 'cai-dat', label: 'Cài đặt', icon: Settings },
  { view: 'doi-mat-khau', label: 'Đổi mật khẩu', icon: KeyRound },
  { view: 'quan-tri', label: 'Quản trị hệ thống', icon: Shield, adminOnly: true },
];

export function AppSidebar({ currentView, onViewChange, refreshKey, notificationBell }: AppSidebarProps) {
  const activeYear = getActiveYear();
  const closed = isYearClosed(activeYear);
  const { isAdmin, profile, signOut } = useAuth();

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  // Nhóm các menu item
  const groups = [
    { label: 'CHÍNH', items: visibleItems.filter(i => ['dashboard', 'cho-ky', 'da-duyet', 'lich-su-ky', 'bao-cao-de-nghi-tham-hoi'].includes(i.view)) },
    { label: 'NGHIỆP VỤ', items: visibleItems.filter(i => ['phieu-tham-hoi', 'de-nghi-thanh-toan', 'phieu-thu', 'phieu-chi'].includes(i.view)) },
    { label: 'SỔ SÁCH', items: visibleItems.filter(i => ['so-quy', 'so-chi-tiet'].includes(i.view)) },
    { label: 'DANH MỤC', items: visibleItems.filter(i => ['danh-sach-can-bo', 'khoa-so', 'cai-dat', 'doi-mat-khau', 'quan-tri'].includes(i.view)) },
  ];

  return (
    <aside className="w-64 min-h-screen bg-card border-r border-border/50 flex flex-col shrink-0 no-print shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-40">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 transition-transform hover:scale-105 duration-300">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-[14px] font-black text-foreground tracking-tight leading-none">
              QUẢN LÝ TÀI CHÍNH
            </h1>
            <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground mt-1.5 font-bold opacity-70">
              Công đoàn cơ sở
            </p>
          </div>
        </div>
        <div className="mt-5 px-3 py-1.5 bg-muted/40 rounded-xl flex items-center gap-2.5 w-full border border-border/30">
          <span className={`inline-block w-2 h-2 rounded-full shadow-sm ${closed ? 'bg-destructive animate-pulse' : 'bg-emerald-500 animate-pulse'}`}></span>
          <span className="text-[10px] font-black text-muted-foreground/80 uppercase tracking-wider">Niên độ {activeYear}</span>
        </div>

        {/* User Profile - Stay at top */}
        <div className="mt-6 pt-6 border-t border-border/50">
          {profile && (
            <div className="flex items-center gap-3 px-1">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-[12px] uppercase shadow-inner">
                {(profile.username || 'AD').substring(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-foreground truncate leading-none mb-1.5 tracking-tight">{profile.full_name}</p>
                <p className="text-[10px] text-muted-foreground/60 truncate font-medium tracking-tight">@{profile.username || 'admin'}</p>
              </div>
              {notificationBell}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 overflow-y-auto space-y-4 pb-6 scrollbar-none">
        {groups.map((group, gIdx) => (
          group.items.length > 0 && (
            <div key={gIdx} className="bg-muted/10 border border-border/40 rounded-2xl p-1.5 shadow-inner">
              {group.items.map(item => {
                const active = currentView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => onViewChange(item.view)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-300 group relative mb-0.5 last:mb-0",
                      active
                        ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                        : 'text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <item.icon className={cn(
                      "h-4 w-4 shrink-0 transition-all duration-300",
                      active ? 'text-white scale-110' : 'text-muted-foreground/50 group-hover:text-primary group-hover:scale-110'
                    )} />
                    <span className="truncate tracking-tight">{item.label}</span>
                    {active && (
                      <span className="absolute left-1.5 w-1 h-4 bg-white/40 rounded-full"></span>
                    )}
                  </button>
                );
              })}
            </div>
          )
        ))}
      </nav>

      {/* Logout at bottom */}
      <div className="p-4 border-t border-border/50 bg-muted/10">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-bold text-muted-foreground hover:bg-destructive/5 hover:text-destructive transition-all duration-300 border border-transparent hover:border-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}


import { useState, useCallback } from 'react';
import { ViewType } from '@/types/finance';
import { AppSidebar } from '@/components/finance/AppSidebar';
import { Dashboard } from '@/components/finance/Dashboard';
import { VoucherForm } from '@/components/finance/VoucherForm';
import { VisitVoucherForm } from '@/components/finance/VisitVoucherForm';
import { PaymentRequestForm } from '@/components/finance/PaymentRequestForm';
import { CashBook } from '@/components/finance/CashBook';
import { DetailLedger } from '@/components/finance/DetailLedger';
import { SettingsForm } from '@/components/finance/SettingsForm';
import { StaffList } from '@/components/finance/StaffList';
import { YearClosing } from '@/components/finance/YearClosing';
import { AdminPanel } from '@/components/finance/AdminPanel';
import { ChangePasswordForm } from '@/components/finance/ChangePasswordForm';
import { SignatureHistory } from '@/components/finance/SignatureHistory';
import { PendingVouchers } from '@/components/finance/PendingVouchers';
import { ApprovedVouchers } from '@/components/finance/ApprovedVouchers';
import { NotificationBell } from '@/components/finance/NotificationBell';
import { useAuth } from '@/hooks/useAuth';

const viewTitles: Record<ViewType, string> = {
  dashboard: 'Tổng quan',
  'phieu-tham-hoi': 'Phiếu Thăm Hỏi',
  'de-nghi-thanh-toan': 'Đề Nghị Thanh Toán',
  'phieu-thu': 'Phiếu Thu',
  'phieu-chi': 'Phiếu Chi',
  'so-quy': 'Sổ Quỹ',
  'so-chi-tiet': 'Sổ Chi Tiết',
  'danh-sach-can-bo': 'Danh Sách Đoàn Viên',
  'khoa-so': 'Khóa Sổ & Kết Chuyển',
  'cai-dat': 'Cài đặt',
  'doi-mat-khau': 'Đổi mật khẩu',
  'lich-su-ky': 'Lịch sử ký duyệt',
  'cho-ky': 'Chứng từ chờ ký',
  'da-duyet': 'Chứng từ đã duyệt',
  'quan-tri': 'Quản trị hệ thống',
};

const Index = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);
  const { isAdmin } = useAuth();

  const handleSaved = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const handleNotificationNavigate = useCallback((view: 'cho-ky' | 'da-duyet') => {
    setCurrentView(view);
  }, []);

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        refreshKey={refreshKey}
        notificationBell={<NotificationBell onNavigate={handleNotificationNavigate} />}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print h-16 shrink-0 border-b border-border bg-card/80 backdrop-blur px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Home className="h-4 w-4 text-muted-foreground" />
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-display font-semibold text-foreground">{viewTitles[currentView]}</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="capitalize">{today}</span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">

        {currentView === 'dashboard' && <Dashboard refreshKey={refreshKey} />}
        {currentView === 'phieu-tham-hoi' && <VisitVoucherForm onSaved={handleSaved} refreshKey={refreshKey} />}
        {currentView === 'de-nghi-thanh-toan' && <PaymentRequestForm onSaved={handleSaved} refreshKey={refreshKey} />}
        {currentView === 'phieu-thu' && <VoucherForm type="thu" onSaved={handleSaved} refreshKey={refreshKey} />}
        {currentView === 'phieu-chi' && <VoucherForm type="chi" onSaved={handleSaved} refreshKey={refreshKey} />}
        {currentView === 'so-quy' && <CashBook refreshKey={refreshKey} />}
        {currentView === 'so-chi-tiet' && <DetailLedger refreshKey={refreshKey} onSaved={handleSaved} />}
        {currentView === 'danh-sach-can-bo' && <StaffList />}
        {currentView === 'khoa-so' && <YearClosing onYearChanged={handleSaved} />}
        {currentView === 'cai-dat' && <SettingsForm onSaved={handleSaved} />}
        {currentView === 'doi-mat-khau' && <ChangePasswordForm />}
        {currentView === 'lich-su-ky' && <SignatureHistory />}
        {currentView === 'cho-ky' && <PendingVouchers />}
        {currentView === 'da-duyet' && <ApprovedVouchers />}
        {currentView === 'quan-tri' && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
};

export default Index;

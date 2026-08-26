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
import { PaymentThamHoiTrackingReport } from '@/components/finance/PaymentThamHoiTrackingReport';
import { NotificationBell } from '@/components/finance/NotificationBell';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Calendar, ChevronRight, Home } from 'lucide-react';

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

  const getViewTitle = (view: ViewType) => {
    switch (view) {
      case 'dashboard': return 'Tổng quan';
      case 'phieu-tham-hoi': return 'Phiếu Thăm Hỏi';
      case 'de-nghi-thanh-toan': return 'Đề Nghị Thanh Toán';
      case 'bao-cao-de-nghi-tham-hoi': return 'Theo dõi thăm hỏi đoàn viên';
      case 'phieu-thu': return 'Phiếu Thu';
      case 'phieu-chi': return 'Phiếu Chi';
      case 'so-quy': return 'Sổ Quỹ';
      case 'so-chi-tiet': return 'Sổ Chi Tiết';
      case 'danh-sach-can-bo': return 'Danh Sách Đoàn Viên';
      case 'khoa-so': return 'Khóa Sổ & Kết Chuyển';
      case 'cai-dat': return 'Cài đặt';
      case 'doi-mat-khau': return 'Đổi mật khẩu';
      case 'lich-su-ky': return 'Lịch sử ký duyệt';
      case 'cho-ky': return 'Chứng từ chờ ký';
      case 'da-duyet': return 'Chứng từ đã duyệt';
      case 'quan-tri': return 'Quản trị hệ thống';
      default: return '';
    }
  };

  return (
    <div className="flex min-h-screen bg-background font-sans antialiased selection:bg-primary/10 selection:text-primary">
      <AppSidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        refreshKey={refreshKey}
        notificationBell={<NotificationBell onNavigate={handleNotificationNavigate} />}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header / Breadcrumbs */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-8 no-print">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Home className="h-4 w-4" />
            <ChevronRight className="h-4 w-4 opacity-50" />
            <span className="text-foreground font-bold">{getViewTitle(currentView)}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full text-[11px] font-bold text-muted-foreground border border-border">
              <Calendar className="h-3 w-3" />
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-8 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {currentView === 'dashboard' && <Dashboard refreshKey={refreshKey} />}
            {currentView === 'phieu-tham-hoi' && <VisitVoucherForm onSaved={handleSaved} refreshKey={refreshKey} />}
            {currentView === 'de-nghi-thanh-toan' && <PaymentRequestForm onSaved={handleSaved} refreshKey={refreshKey} />}
            {currentView === 'bao-cao-de-nghi-tham-hoi' && (
              <PaymentThamHoiTrackingReport key={`bc-th-${refreshKey}`} refreshKey={refreshKey} />
            )}
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
          </div>
        </main>

        {/* Footer with Marquee */}
        <footer className="h-10 border-t border-border bg-card/80 backdrop-blur-md flex items-center overflow-hidden no-print shrink-0 relative">
          <div className="animate-marquee whitespace-nowrap text-[12px] font-normal text-black tracking-normal py-2 capitalize">
            CopyRight @ Trần Nam Long VDB-Chi nhánh Khu vực Bắc Đông Bắc, PGD Cao Bằng
          </div>
        </footer>
      </div>
    </div>
  );
};


export default Index;

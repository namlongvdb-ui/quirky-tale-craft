import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { getTransactions, getOpeningBalance, getOrgSettings, getActiveYear } from '@/lib/finance-store';
import { exportFullReportExcel } from '@/lib/export-utils';
import { Wallet, TrendingUp, TrendingDown, Banknote, Download, ClipboardList, Clock3, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN');
}

export function Dashboard({ refreshKey }: { refreshKey?: number }) {
  const settings = getOrgSettings();
  const activeYear = getActiveYear();
  const stats = useMemo(() => {
    const txs = getTransactions();
    const opening = getOpeningBalance();
    const totalThu = txs.filter(t => t.type === 'thu').reduce((s, t) => s + t.amount, 0);
    const totalChi = txs.filter(t => t.type === 'chi').reduce((s, t) => s + t.amount, 0);
    const closing = opening + totalThu - totalChi;
    const ratio = totalChi > 0 ? totalThu / totalChi : 0;
    const avg = txs.length > 0 ? Math.round((totalThu + totalChi) / txs.length) : 0;
    return { opening, totalThu, totalChi, closing, txCount: txs.length, ratio, avg };
  }, [refreshKey]);

  const cards = [
    {
      title: 'Số dư đầu kỳ',
      value: stats.opening,
      icon: Banknote,
      ring: 'ring-primary/15',
      chip: 'bg-primary/10 text-primary',
      value_class: 'text-foreground',
    },
    {
      title: 'Tổng thu',
      value: stats.totalThu,
      icon: TrendingUp,
      ring: 'ring-emerald-200',
      chip: 'bg-emerald-50 text-emerald-600',
      value_class: 'text-emerald-600',
    },
    {
      title: 'Tổng chi',
      value: stats.totalChi,
      icon: TrendingDown,
      ring: 'ring-rose-200',
      chip: 'bg-rose-50 text-rose-500',
      value_class: 'text-rose-600',
    },
    {
      title: 'Số dư cuối kỳ',
      value: stats.closing,
      icon: Wallet,
      ring: 'ring-primary/15',
      chip: 'bg-primary/10 text-primary',
      value_class: 'text-primary',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-3">
          <h1 className="font-serif text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Tổng quan tài chính
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Niên độ {activeYear}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {settings.orgSubName}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={exportFullReportExcel} className="h-12 px-6 text-xs font-semibold uppercase tracking-[0.14em]">
          <Download className="mr-2 h-4 w-4" /> Xuất báo cáo Excel
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(card => (
          <Card key={card.title} className={`border-0 shadow-sm ring-1 ${card.ring} rounded-2xl`}>
            <CardContent className="space-y-8 p-6">
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.chip}`}>
                  <card.icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {card.title}
                </span>
              </div>
              <p className={`font-serif text-2xl font-bold ${card.value_class}`}>
                {formatCurrency(card.value)} <span className="text-sm font-medium text-muted-foreground underline">đ</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* System activity */}
        <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-border overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-6 py-4">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Hoạt động hệ thống</h2>
          </div>
          <CardContent className="flex flex-col items-center gap-5 py-10">
            <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-primary/15">
              <span className="font-serif text-4xl font-bold text-primary">{stats.txCount}</span>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tổng chứng từ</p>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
              Dữ liệu trực tuyến
            </span>
          </CardContent>
        </Card>

        {/* Quick analytics */}
        <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-border overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-6 py-4">
            <Clock3 className="h-4 w-4 text-primary" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">Chỉ số phân tích nhanh</h2>
          </div>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              <li className="flex items-center justify-between gap-4 px-6 py-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <TrendingUp className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Tỷ lệ thu / chi</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cân đối dòng tiền</p>
                  </div>
                </div>
                <p className="font-serif text-lg font-bold text-foreground">
                  {stats.ratio.toFixed(2)} <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">lần</span>
                </p>
              </li>
              <li className="flex items-center justify-between gap-4 px-6 py-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Giá trị bình quân</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Trên mỗi chứng từ</p>
                  </div>
                </div>
                <p className="font-serif text-lg font-bold text-foreground">
                  {formatCurrency(stats.avg)} <span className="text-sm font-medium text-muted-foreground underline">đ</span>
                </p>
              </li>
              <li className="flex items-center justify-between gap-4 px-6 py-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <FileDown className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Kết xuất dữ liệu</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Định dạng Microsoft Excel</p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-600">
                  Sẵn sàng
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

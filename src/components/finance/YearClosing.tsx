import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  getActiveYear, setActiveYear, getAvailableYears, getYearDataList,
  calculateClosingBalance, closeYear, isYearClosed, getOpeningBalanceForYear,
  getTransactionsForYear, unlockYear
} from '@/lib/finance-store';
import { Lock, Unlock, ArrowRightLeft, Calendar, BookOpenCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

function fmt(n: number) { return n.toLocaleString('vi-VN'); }

interface YearClosingProps {
  onYearChanged?: () => void;
}

export function YearClosing({ onYearChanged }: YearClosingProps) {
  const { isAdmin } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<number | null>(null);

  const activeYear = useMemo(() => getActiveYear(), [refreshKey]);
  const availableYears = useMemo(() => getAvailableYears(), [refreshKey]);
  const yearDataList = useMemo(() => getYearDataList().sort((a, b) => b.year - a.year), [refreshKey]);
  const isClosed = useMemo(() => isYearClosed(activeYear), [activeYear, refreshKey]);

  const currentYearStats = useMemo(() => {
    const txs = getTransactionsForYear(activeYear);
    const opening = getOpeningBalanceForYear(activeYear);
    const totalThu = txs.filter(t => t.type === 'thu').reduce((s, t) => s + t.amount, 0);
    const totalChi = txs.filter(t => t.type === 'chi').reduce((s, t) => s + t.amount, 0);
    const closing = opening + totalThu - totalChi;
    return { opening, totalThu, totalChi, closing, txCount: txs.length };
  }, [activeYear, refreshKey]);

  const handleCloseYear = () => {
    const result = closeYear(activeYear);
    if (result.success) {
      toast.success(result.message);
      setRefreshKey(k => k + 1);
      onYearChanged?.();
    } else {
      toast.error(result.message);
    }
    setShowConfirm(false);
  };

  const handleSwitchYear = (yearStr: string) => {
    const year = parseInt(yearStr, 10);
    setActiveYear(year);
    setRefreshKey(k => k + 1);
    onYearChanged?.();
    toast.info(`Đã chuyển sang năm ${year}`);
  };

  const handleUnlockYear = () => {
    if (unlockTarget == null) return;
    const result = unlockYear(unlockTarget);
    if (result.success) {
      toast.success(result.message);
      setRefreshKey(k => k + 1);
      onYearChanged?.();
    } else {
      toast.error(result.message);
    }
    setUnlockTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <Card className="border-border shadow-lg">
        <CardHeader className="bg-primary/5 border-b border-border">
          <CardTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <BookOpenCheck className="h-6 w-6" /> KHÓA SỔ & KẾT CHUYỂN
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Năm hạch toán:</span>
              <Select value={String(activeYear)} onValueChange={handleSwitchYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={String(y)}>
                      {y} {isYearClosed(y) ? '🔒' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant={isClosed ? 'destructive' : 'default'} className="text-sm py-1 px-3">
              {isClosed ? (
                <><Lock className="h-3.5 w-3.5 mr-1" /> Đã khóa sổ</>
              ) : (
                <><Unlock className="h-3.5 w-3.5 mr-1" /> Đang mở</>
              )}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Current Year Summary */}
      <Card className="border-border shadow-lg">
        <CardHeader className="bg-primary/5 border-b border-border">
          <CardTitle className="text-lg font-bold text-primary">
            Tổng hợp năm {activeYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Số dư đầu kỳ</p>
              <p className="text-lg font-bold text-primary">{fmt(currentYearStats.opening)} đ</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Tổng thu</p>
              <p className="text-lg font-bold text-green-600">{fmt(currentYearStats.totalThu)} đ</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-muted-foreground">Tổng chi</p>
              <p className="text-lg font-bold text-destructive">{fmt(currentYearStats.totalChi)} đ</p>
            </div>
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <p className="text-sm text-muted-foreground">Số dư cuối kỳ</p>
              <p className="text-lg font-bold text-primary">{fmt(currentYearStats.closing)} đ</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Số chứng từ</p>
              <p className="text-lg font-bold">{currentYearStats.txCount}</p>
            </div>
          </div>

          {!isClosed && (
            <div className="mt-6 flex justify-center">
              <Button 
                size="lg" 
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                onClick={() => setShowConfirm(true)}
              >
                <ArrowRightLeft className="h-5 w-5" />
                Khóa sổ năm {activeYear} & Kết chuyển sang năm {activeYear + 1}
              </Button>
            </div>
          )}

          {isClosed && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-center space-y-3">
              <p className="text-amber-800 font-medium">
                ⚠️ Năm {activeYear} đã khóa sổ. Bạn chỉ có thể xem, không thể thêm/sửa/xóa chứng từ.
              </p>
              {isAdmin && (
                <Button
                  variant="outline"
                  className="gap-2 border-amber-600 text-amber-700 hover:bg-amber-100"
                  onClick={() => setUnlockTarget(activeYear)}
                >
                  <KeyRound className="h-4 w-4" />
                  Mở lại sổ năm {activeYear} (Admin)
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Year History Table */}
      <Card className="border-border shadow-lg">
        <CardHeader className="bg-primary/5 border-b border-border">
          <CardTitle className="text-lg font-bold text-primary">
            Lịch sử các năm
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-center">Năm</TableHead>
                <TableHead className="text-right">Số dư đầu kỳ</TableHead>
                <TableHead className="text-right">Tổng thu</TableHead>
                <TableHead className="text-right">Tổng chi</TableHead>
                <TableHead className="text-right">Số dư cuối kỳ</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
                <TableHead className="text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {yearDataList.map(yd => {
                const txs = getTransactionsForYear(yd.year);
                const totalThu = txs.filter(t => t.type === 'thu').reduce((s, t) => s + t.amount, 0);
                const totalChi = txs.filter(t => t.type === 'chi').reduce((s, t) => s + t.amount, 0);
                const closing = yd.openingBalance + totalThu - totalChi;
                return (
                  <TableRow key={yd.year} className={yd.year === activeYear ? 'bg-primary/5' : ''}>
                    <TableCell className="text-center font-bold">{yd.year}</TableCell>
                    <TableCell className="text-right">{fmt(yd.openingBalance)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(totalThu)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(totalChi)}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(closing)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={yd.isClosed ? 'destructive' : 'default'} className="text-xs">
                        {yd.isClosed ? '🔒 Đã khóa' : '🔓 Đang mở'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSwitchYear(String(yd.year))}
                          disabled={yd.year === activeYear}
                        >
                          {yd.year === activeYear ? 'Đang xem' : 'Xem'}
                        </Button>
                        {isAdmin && yd.isClosed && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-amber-600 text-amber-700 hover:bg-amber-50 gap-1"
                            onClick={() => setUnlockTarget(yd.year)}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Mở lại
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận khóa sổ năm {activeYear}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Bạn có chắc chắn muốn khóa sổ năm {activeYear}?</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Số dư cuối kỳ: <strong>{fmt(currentYearStats.closing)} đ</strong> sẽ được kết chuyển làm số dư đầu kỳ năm {activeYear + 1}.</li>
                <li>Số chứng từ năm {activeYear + 1} sẽ được reset từ đầu (PT001, PC001...).</li>
                <li>Sau khi khóa sổ, bạn không thể thêm/sửa/xóa chứng từ của năm {activeYear}.</li>
                <li>Bạn vẫn có thể xem lại số liệu năm {activeYear} bằng cách chọn năm trong danh sách.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleCloseYear} className="bg-amber-600 hover:bg-amber-700">
              Xác nhận khóa sổ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock Year Dialog (Admin only) */}
      <AlertDialog open={unlockTarget != null} onOpenChange={(o) => !o && setUnlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mở lại sổ năm {unlockTarget}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Bạn (Admin) đang yêu cầu mở lại sổ năm <strong>{unlockTarget}</strong>.</p>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Năm này sẽ chuyển về trạng thái "Đang mở" và có thể thêm/sửa/xóa chứng từ.</li>
                <li>Số dư đầu kỳ các năm sau KHÔNG tự động tính lại — nếu chỉnh số liệu, hãy khóa sổ lại để kết chuyển chính xác.</li>
                <li>Thao tác này chỉ dành cho mục đích chỉnh sửa sai sót.</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlockYear} className="bg-amber-600 hover:bg-amber-700">
              Xác nhận mở lại
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useTransactions } from '@/hooks/useFinanceData';
import { Transaction } from '@/types/finance';
import { Search, Trash2, Pencil, FileText, X, ChevronDown, ChevronUp, List, Lock, Eye, CalendarIcon } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { VoucherSignatureStatus, SignVoucherButton } from './VoucherSignature';
import { pendingVouchersApi } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { PrintVoucher } from './PrintVoucher';
import { PrintVisitVoucher } from './PrintVisitVoucher';
import { PrintPaymentRequest } from './PrintPaymentRequest';

interface TransactionListProps {
  type: 'thu' | 'chi' | 'tham-hoi' | 'de-nghi';
  title: string;
  personLabel?: string;
  onChanged?: () => void;
  refreshKey?: number;
  onSelectForEdit?: (tx: Transaction) => void;
  containerClassName?: string;
}

function formatCurrency(n: number) {
  return n.toLocaleString('vi-VN');
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function TransactionList({ type, title, personLabel, onChanged, refreshKey, onSelectForEdit }: TransactionListProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [sigRefreshKey, setSigRefreshKey] = useState(0);
  const [approvedVoucherIds, setApprovedVoucherIds] = useState<Set<string>>(new Set());
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const { user, hasRole, isAdmin } = useAuth();

  const { transactions, deleteTransaction } = useTransactions(undefined, type, refreshKey);

  const isVoucher = type === 'thu' || type === 'chi';
  const isDeNghi = type === 'de-nghi';

  const fetchApprovedIds = useCallback(async () => {
    const { data } = await pendingVouchersApi.getAll();
    if (data) {
      const approved = data.filter((v: any) =>
        v.voucher_type === type && ['signed', 'printed'].includes(v.status)
      );
      setApprovedVoucherIds(new Set(approved.map((v: any) => v.voucher_id)));
    }
  }, [type]);

  useEffect(() => {
    fetchApprovedIds();
  }, [fetchApprovedIds, refreshKey, sigRefreshKey]);

  const isApproved = (voucherNo: string) => approvedVoucherIds.has(voucherNo);

  const canEdit = (tx: Transaction) => {
    if (isApproved(tx.voucherNo)) return false;
    if (!user) return false;
    if (isAdmin) return true;
    if (!tx.createdBy) return false;
    return tx.createdBy === user.id;
  };

  const canDelete = (tx: Transaction) => {
    if (!user) return false;
    if (isApproved(tx.voucherNo)) return isAdmin;
    if (isAdmin) return true;
    if (!tx.createdBy) return false;
    return tx.createdBy === user.id;
  };

  const filtered = useMemo(() => {
    let result = transactions;
    if (dateFrom || dateTo) {
      result = result.filter(t => {
        const txDate = new Date(t.date);
        if (dateFrom && dateTo) return isWithinInterval(txDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
        if (dateFrom) return txDate >= startOfDay(dateFrom);
        if (dateTo) return txDate <= endOfDay(dateTo);
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.voucherNo.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) ||
        t.personName.toLowerCase().includes(q) || t.department.toLowerCase().includes(q) ||
        t.amount.toString().includes(q) ||
        (isDeNghi && (t.linkedThamHoiVoucherNo || '').toLowerCase().includes(q))
      );
    }
    return result;
  }, [transactions, search, dateFrom, dateTo, isDeNghi]);

  const totalAmount = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);

  const handleDelete = async (tx: Transaction) => {
    if (!canDelete(tx)) { toast.error('Bạn không có quyền xóa chứng từ này'); return; }
    await deleteTransaction(tx.id);
    toast.success(`Đã xóa ${tx.voucherNo}`);
    onChanged?.();
  };

  const handleEdit = (tx: Transaction) => {
    if (!canEdit(tx)) { toast.error('Bạn không có quyền sửa chứng từ này'); return; }
    onSelectForEdit?.(tx);
  };

  return (
    <>
    <div className="max-w-5xl mx-auto mt-8 no-print">
      <button
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 rounded-lg bg-card border border-border shadow-sm hover:bg-muted/40 transition-colors mb-0 group"
      >
        <div className="flex items-center gap-2.5">
          <List className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Danh sách {title.toLowerCase()}</span>
          <Badge variant="secondary" className="text-xs px-1.5 py-0 font-medium">{transactions.length}</Badge>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {isOpen && (
      <Card className="border-border shadow-xl overflow-hidden rounded-t-none border-t-0 bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-muted/10 border-b border-border/50 px-8 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-black text-foreground tracking-tight">{title}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 text-[10px] font-bold uppercase tracking-wider px-2 py-0">
                    {transactions.length} chứng từ
                  </Badge>
                  {filtered.length !== transactions.length && (
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                      · {filtered.length} kết quả tìm kiếm
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 bg-background/50 p-1 rounded-xl border border-border/50 shadow-sm">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("h-9 text-[11px] font-bold gap-2 px-3 hover:bg-muted/80 rounded-lg", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'TỪ NGÀY'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3" />
                  </PopoverContent>
                </Popover>
                <div className="h-4 w-[1px] bg-border/50" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className={cn("h-9 text-[11px] font-bold gap-2 px-3 hover:bg-muted/80 rounded-lg", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'ĐẾN NGÀY'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3" />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="relative w-full sm:w-80 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                <Input 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  placeholder="Tìm số CT, nội dung, họ tên..." 
                  className="pl-11 pr-11 h-11 text-sm bg-background border-border/50 focus:border-primary focus:ring-primary/10 transition-all rounded-xl shadow-sm" 
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-8">
              <div className="h-20 w-20 rounded-full bg-muted/30 flex items-center justify-center mb-6 animate-pulse">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <p className="text-base font-bold text-foreground">
                {search ? 'Không tìm thấy kết quả nào' : `Danh sách ${title.toLowerCase()} đang trống`}
              </p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs text-center leading-relaxed">
                {search ? 'Vui lòng kiểm tra lại từ khóa hoặc bộ lọc ngày tháng' : 'Hãy bắt đầu bằng cách tạo một chứng từ mới bằng form nhập liệu phía trên'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/50">
                      <TableHead className="w-[110px] text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] pl-8 h-12">SỐ HIỆU</TableHead>
                      <TableHead className="w-[110px] text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] h-12">NGÀY LẬP</TableHead>
                      <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] h-12">NỘI DUNG GIAO DỊCH</TableHead>
                      <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] h-12">{personLabel?.toUpperCase() || 'HỌ TÊN'}</TableHead>
                      <TableHead className="text-right text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] pr-8 h-12">SỐ TIỀN</TableHead>
                      {isDeNghi && <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] h-12">LIÊN KẾT</TableHead>}
                      {isVoucher && <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] h-12">TRẠNG THÁI</TableHead>}
                      {isVoucher && <TableHead className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] h-12">DUYỆT</TableHead>}
                      <TableHead className="w-[140px] text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] h-12 text-center">THAO TÁC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((tx) => {
                      const locked = isApproved(tx.voucherNo);
                      const editable = canEdit(tx);
                      const deletable = canDelete(tx);
                      return (
                        <TableRow 
                          key={tx.id} 
                          className={cn(
                            "group transition-all border-b border-border/30 last:border-b-0",
                            editable ? 'cursor-pointer hover:bg-primary/[0.02]' : 'cursor-default bg-muted/[0.02]'
                          )} 
                          onClick={() => editable && handleEdit(tx)}
                        >
                          <TableCell className="pl-8 py-4">
                            <div className="flex items-center gap-2">
                              {locked && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Lock className="h-3 w-3 text-emerald-600 flex-shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent><p>Chứng từ đã được duyệt/in, không thể sửa xóa</p></TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <Badge variant="outline" className="font-mono text-[11px] font-bold px-2 py-0.5 bg-background text-primary border-primary/20 group-hover:border-primary/40 transition-colors">
                                {tx.voucherNo}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-[13px] text-muted-foreground tabular-nums font-medium py-4">{formatDate(tx.date)}</TableCell>
                          <TableCell className="max-w-[300px] py-4">
                            <p className="text-[13px] font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">{tx.description}</p>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col">
                              <span className="text-[13px] font-bold text-foreground/80">{tx.personName}</span>
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter line-clamp-1">{tx.department}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-8 py-4">
                            <span className="text-[14px] font-black tabular-nums text-foreground">{formatCurrency(tx.amount)}</span>
                            <span className="text-[10px] font-bold text-muted-foreground ml-1">₫</span>
                          </TableCell>
                          {isDeNghi && (
                            <TableCell className="py-4">
                              {tx.linkedThamHoiVoucherNo ? (
                                <Badge variant="secondary" className="font-mono text-[10px] bg-indigo-50 text-indigo-700 border-indigo-100">{tx.linkedThamHoiVoucherNo}</Badge>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/50">—</span>
                              )}
                            </TableCell>
                          )}
                          {isVoucher && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              <VoucherSignatureStatus transaction={tx} voucherType={type as 'thu' | 'chi'} key={`sig-${tx.id}-${sigRefreshKey}`} />
                            </TableCell>
                          )}
                          {isVoucher && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              <SignVoucherButton transaction={tx} voucherType={type as 'thu' | 'chi'} hideSignAction onSigned={() => setSigRefreshKey(k => k + 1)} />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); setPreviewTx(tx); }}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Xem trước khi in</TooltipContent>
                              </Tooltip>
                              {locked ? (
                                <div className="flex items-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">Đã duyệt</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{deletable ? 'Chứng từ đã duyệt, chỉ Admin được xóa' : 'Chứng từ đã được ký duyệt, không thể sửa/xóa'}</TooltipContent>
                                  </Tooltip>
                                  {deletable && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Xóa {tx.voucherNo}?</AlertDialogTitle>
                                          <AlertDialogDescription>Chứng từ này đã duyệt. Chỉ Admin mới được xóa và thao tác này không thể hoàn tác.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(tx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              ) : editable || deletable ? (
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {editable && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); handleEdit(tx); }}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {deletable && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Xóa {tx.voucherNo}?</AlertDialogTitle>
                                          <AlertDialogDescription>Thao tác này không thể hoàn tác.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Hủy</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDelete(tx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="px-6 py-3 bg-muted/20 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{filtered.length} chứng từ</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(totalAmount)} ₫</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>

    {/* Print preview dialog */}
    <Dialog open={!!previewTx} onOpenChange={(open) => { if (!open) setPreviewTx(null); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {previewTx && (
          <div>
            <div className="flex justify-end mb-2 no-print">
              <Button size="sm" onClick={() => window.print()}><Eye className="h-4 w-4 mr-1" /> In</Button>
            </div>
            {(type === 'thu' || type === 'chi') && (
              <PrintVoucher type={type} data={{ date: previewTx.date, voucherNo: previewTx.voucherNo, amount: previewTx.amount, description: previewTx.description, personName: previewTx.personName, department: previewTx.department, accountCode: previewTx.accountCode, approver: previewTx.approver, attachments: previewTx.attachments }} />
            )}
            {type === 'tham-hoi' && (
              <PrintVisitVoucher
                data={{
                  date: previewTx.date,
                  visitorDepartment: previewTx.department,
                  recipientName: previewTx.recipientName || previewTx.personName,
                  reason: previewTx.reason || previewTx.description,
                  amount: previewTx.amount,
                  unionGroupName: previewTx.department,
                }}
              />
            )}
            {type === 'de-nghi' && (
              <PrintPaymentRequest
                data={{
                  date: previewTx.date,
                  requestNo: '',
                  requesterName: previewTx.personName,
                  department: previewTx.department,
                  content: previewTx.description,
                  amount: previewTx.amount,
                  times: previewTx.times || '',
                  bankAccount: previewTx.bankAccount || '',
                  bankAccountName: previewTx.bankAccountName || '',
                  bankName: previewTx.bankName || '',
                  attachments: String(previewTx.attachments || ''),
                }}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { getTransactions, deleteTransaction } from '@/lib/finance-store';
import { Transaction } from '@/types/finance';
import { Search, Trash2, Pencil, FileText, X, ChevronDown, ChevronUp, List, Lock, Eye, CalendarIcon } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { toast } from 'sonner';
import { VoucherSignatureStatus, SignVoucherButton } from './VoucherSignature';
import { supabase } from '@/integrations/supabase/client';
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

export function TransactionList({ type, title, personLabel, onChanged, refreshKey, onSelectForEdit, containerClassName }: TransactionListProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [sigRefreshKey, setSigRefreshKey] = useState(0);
  const [approvedVoucherIds, setApprovedVoucherIds] = useState<Set<string>>(new Set());
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const { user } = useAuth();

  const isVoucher = type === 'thu' || type === 'chi';

  // Fetch approved/signed voucher IDs to prevent editing
  const fetchApprovedIds = useCallback(async () => {
    const { data } = await supabase
      .from('pending_vouchers')
      .select('voucher_id')
      .eq('voucher_type', type)
      .in('status', ['signed', 'printed']);
    
    if (data) {
      setApprovedVoucherIds(new Set(data.map(v => v.voucher_id)));
    }
  }, [type]);

  useEffect(() => {
    fetchApprovedIds();
  }, [fetchApprovedIds, refreshKey, sigRefreshKey]);

  const isApproved = (voucherNo: string) => approvedVoucherIds.has(voucherNo);

  const canModify = (tx: Transaction) => {
    if (isApproved(tx.voucherNo)) return false;
    if (!user) return false;
    if (!tx.createdBy) return true;
    return tx.createdBy === user.id;
  };

  const transactions = useMemo(() => {
    return getTransactions().filter(t => t.type === type);
  }, [type, refreshKey]);

  const filtered = useMemo(() => {
    let result = transactions;

    // Date range filter
    if (dateFrom || dateTo) {
      result = result.filter(t => {
        const txDate = new Date(t.date);
        if (dateFrom && dateTo) {
          return isWithinInterval(txDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
        }
        if (dateFrom) return txDate >= startOfDay(dateFrom);
        if (dateTo) return txDate <= endOfDay(dateTo);
        return true;
      });
    }

    // Text search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.voucherNo.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.personName.toLowerCase().includes(q) ||
        t.department.toLowerCase().includes(q) ||
        t.amount.toString().includes(q)
      );
    }
    return result;
  }, [transactions, search, dateFrom, dateTo]);

  const totalAmount = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);

  const handleDelete = (tx: Transaction) => {
    if (!canModify(tx)) {
      toast.error('Bạn không có quyền xóa chứng từ này');
      return;
    }
    deleteTransaction(tx.id);
    toast.success(`Đã xóa ${tx.voucherNo}`);
    onChanged?.();
  };

  const handleEdit = (tx: Transaction) => {
    if (!canModify(tx)) {
      toast.error('Bạn không có quyền sửa chứng từ này');
      return;
    }
    onSelectForEdit?.(tx);
  };

  return (
    <>
    <div className={cn('max-w-5xl mx-auto mt-8 no-print', containerClassName)}>
      {/* Toggle button */}
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
      <Card className="border-border shadow-sm overflow-hidden rounded-t-none border-t-0">
        {/* Header */}
        <CardHeader className="bg-card border-b border-border px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                <FileText className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground tracking-tight">
                  {title}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {transactions.length} chứng từ
                  {filtered.length !== transactions.length && ` · ${filtered.length} kết quả`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Date filter */}
              <div className="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Từ ngày'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <span className="text-xs text-muted-foreground">→</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 text-xs gap-1", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'Đến ngày'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Tìm số CT, nội dung, họ tên..."
                  className="pl-9 pr-9 h-9 text-sm bg-muted/40 border-border focus:bg-card transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {search ? 'Không tìm thấy kết quả' : `Chưa có ${title.toLowerCase()}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? 'Thử tìm kiếm với từ khóa khác' : 'Tạo chứng từ mới ở form bên trên'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[90px] text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-6">Số CT</TableHead>
                      <TableHead className="w-[95px] text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ngày</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nội dung</TableHead>
                      <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{personLabel || 'Họ tên'}</TableHead>
                      <TableHead className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pr-4">Số tiền</TableHead>
                      {isVoucher && <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chữ ký</TableHead>}
                      {isVoucher && <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ký duyệt</TableHead>}
                      <TableHead className="w-[120px] text-xs font-semibold text-muted-foreground uppercase tracking-wider">Thao tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((tx) => {
                      const locked = isApproved(tx.voucherNo);
                      const editable = canModify(tx);
                      return (
                        <TableRow
                          key={tx.id}
                          className={`group transition-colors border-b border-border/50 last:border-b-0 ${editable ? 'cursor-pointer hover:bg-primary/[0.03]' : 'cursor-default'}`}
                          onClick={() => editable && handleEdit(tx)}
                        >
                          <TableCell className="pl-6">
                            <div className="flex items-center gap-1.5">
                              {locked && <Lock className="h-3 w-3 text-green-600 dark:text-green-400 flex-shrink-0" />}
                              <Badge variant="secondary" className="font-mono text-xs font-medium px-2 py-0.5 bg-primary/8 text-primary border-0">
                                {tx.voucherNo}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground tabular-nums">
                            {formatDate(tx.date)}
                          </TableCell>
                          <TableCell className="max-w-[280px]">
                            <p className="text-sm text-foreground truncate leading-tight">{tx.description}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-foreground/80">{tx.personName}</span>
                          </TableCell>
                          <TableCell className="text-right pr-4">
                            <span className="text-sm font-semibold tabular-nums text-foreground">
                              {formatCurrency(tx.amount)} ₫
                            </span>
                          </TableCell>
                          {isVoucher && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              <VoucherSignatureStatus transaction={tx} voucherType={type as 'thu' | 'chi'} key={`sig-${tx.id}-${sigRefreshKey}`} />
                            </TableCell>
                          )}
                          {isVoucher && (
                            <TableCell onClick={e => e.stopPropagation()}>
                              <SignVoucherButton
                                transaction={tx}
                                voucherType={type as 'thu' | 'chi'}
                                onSigned={() => setSigRefreshKey(k => k + 1)}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-0.5">
                              {/* Print preview button - always visible */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={(e) => { e.stopPropagation(); setPreviewTx(tx); }}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Xem trước khi in</TooltipContent>
                              </Tooltip>

                              {locked ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-xs text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">
                                      Đã duyệt
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>Chứng từ đã được ký duyệt, không thể sửa/xóa</TooltipContent>
                                </Tooltip>
                              ) : editable ? (
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={(e) => { e.stopPropagation(); handleEdit(tx); }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Xóa {tx.voucherNo}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Bạn có chắc muốn xóa phiếu <strong>{tx.voucherNo}</strong> — "{tx.description}"? Thao tác này không thể hoàn tác.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(tx)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          Xóa
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
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

              {/* Footer summary */}
              <div className="flex items-center justify-between px-6 py-3 bg-muted/20 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Hiển thị {filtered.length}/{transactions.length} chứng từ
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Tổng cộng:</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {formatCurrency(totalAmount)} ₫
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>

    {/* Print Preview Dialog */}
    <Dialog open={!!previewTx} onOpenChange={open => { if (!open) setPreviewTx(null); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        {previewTx && (type === 'thu' || type === 'chi') && (
          <PrintVoucher type={type} data={previewTx} />
        )}
        {previewTx && type === 'tham-hoi' && (
          <PrintVisitVoucher data={{
            date: previewTx.date,
            visitorDepartment: previewTx.department,
            recipientName: previewTx.recipientName || previewTx.personName,
            reason: previewTx.reason || previewTx.description,
            amount: previewTx.amount,
            unionGroupName: previewTx.department,
          }} />
        )}
        {previewTx && type === 'de-nghi' && (
          <PrintPaymentRequest data={{
            date: previewTx.date,
            requestNo: previewTx.voucherNo,
            requesterName: previewTx.personName,
            department: previewTx.department,
            content: previewTx.description,
            amount: previewTx.amount,
            times: previewTx.times || '',
            bankAccount: previewTx.bankAccount || '',
            bankAccountName: previewTx.bankAccountName || '',
            bankName: previewTx.bankName || '',
            attachments: String(previewTx.attachments || 0),
          }} />
        )}
        <div className="flex justify-end mt-4">
          <Button onClick={() => { window.print(); }} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" /> In chứng từ
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

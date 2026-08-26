import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Transaction } from '@/types/finance';
import { ClipboardList, Printer, Download, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PrintDetailLedger } from './PrintDetailLedger';
import { EditTransactionDialog } from './EditTransactionDialog';
import { exportDetailLedgerExcel } from '@/lib/export-utils';
import { useAuth } from '@/hooks/useAuth';
import { pendingVouchersApi } from '@/lib/api-client';
import { useOrgSettings, useTransactions } from '@/hooks/useFinanceData';
import { useEffect, useCallback } from 'react';

function formatCurrency(n: number) { return n.toLocaleString('vi-VN'); }
function formatDate(d: string) { return new Date(d).toLocaleDateString('vi-VN'); }

const typeLabels: Record<string, { label: string; class: string }> = {
  thu: { label: 'PT', class: 'bg-green-100 text-green-700' },
  chi: { label: 'PC', class: 'bg-red-100 text-red-700' },
  'tham-hoi': { label: 'TH', class: 'bg-blue-100 text-blue-700' },
  'de-nghi': { label: 'DN', class: 'bg-amber-100 text-amber-700' },
};

interface DetailLedgerProps {
  refreshKey?: number;
  onSaved?: () => void;
}

export function DetailLedger({ refreshKey, onSaved }: DetailLedgerProps) {
  const { settings } = useOrgSettings();
  const { transactions, deleteTransaction, refetch } = useTransactions(undefined, undefined, refreshKey);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const { user, hasRole, isAdmin } = useAuth();
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    return transactions.filter(tx => tx.type === 'thu' || tx.type === 'chi').sort((a, b) => a.date.localeCompare(b.date));
  }, [transactions]);

  const fetchApprovedIds = useCallback(async () => {
    const { data } = await pendingVouchersApi.getAll();
    if (data) {
      const approved = data.filter((v: any) =>
        ['thu', 'chi'].includes(v.voucher_type) && ['signed', 'printed'].includes(v.status)
      );
      setApprovedIds(new Set(approved.map((v: any) => v.voucher_id)));
    }
  }, []);

  useEffect(() => { fetchApprovedIds(); }, [fetchApprovedIds, refreshKey]);

  const canEdit = (tx: Transaction) => {
    if (approvedIds.has(tx.voucherNo)) return false;
    if (!user) return false;
    if (isAdmin) return true;
    if (!tx.createdBy) return false;
    return tx.createdBy === user.id;
  };

  const canDelete = (tx: Transaction) => {
    if (!user) return false;
    if (approvedIds.has(tx.voucherNo)) return isAdmin;
    if (isAdmin) return true;
    if (!tx.createdBy) return false;
    return tx.createdBy === user.id;
  };

  const handleRefresh = () => {
    refetch();
    onSaved?.();
  };

  const handleDelete = async () => {
    if (!deleteTx) return;
    if (!canDelete(deleteTx)) {
      toast.error('Bạn không có quyền xóa chứng từ này');
      return;
    }
    await deleteTransaction(deleteTx.id);
    toast.success('Đã xóa chứng từ');
    setDeleteTx(null);
    handleRefresh();
  };

  return (
    <>
      <Card className="border-border shadow-lg no-print">
        <CardHeader className="bg-primary/5 border-b border-border text-center relative">
          <div className="absolute right-4 top-4 flex gap-2">
            <Button variant="outline" size="sm" onClick={async () => await exportDetailLedgerExcel()}>
              <Download className="h-4 w-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> In sổ
            </Button>
          </div>
          <CardTitle className="text-2xl font-bold text-primary flex items-center justify-center gap-2">
            <ClipboardList className="h-6 w-6" /> SỔ CHI TIẾT
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-center w-28">Ngày CT</TableHead>
                  <TableHead className="text-center w-20">Số CT</TableHead>
                  <TableHead className="text-right w-28">Số tiền</TableHead>
                  <TableHead className="max-w-xs">Nội dung</TableHead>
                  <TableHead className="text-center w-16">Loại</TableHead>
                  <TableHead className="text-center w-20">TK Nợ</TableHead>
                  <TableHead className="text-center w-20">TK Có</TableHead>
                  <TableHead className="w-28">Họ tên</TableHead>
                  <TableHead className="w-40">Đơn vị</TableHead>
                  <TableHead className="text-center w-24">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => {
                  const t = typeLabels[row.type] || { label: row.type, class: 'bg-muted text-muted-foreground' };
                  return (
                    <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center text-sm">{formatDate(row.date)}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{row.voucherNo}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(row.amount)}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{row.description}</TableCell>
                      <TableCell className="text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${t.class}`}>{t.label}</span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm">{row.type === 'thu' ? '111' : (row.accountCode || '')}</TableCell>
                      <TableCell className="text-center font-mono text-sm">{row.type === 'chi' ? '111' : (row.accountCode || '')}</TableCell>
                      <TableCell className="text-sm">{row.personName}</TableCell>
                      <TableCell className="text-sm truncate max-w-[10rem]">{row.department}</TableCell>
                      <TableCell>
                        {canEdit(row) || canDelete(row) ? (
                          <div className="flex items-center justify-center gap-1">
                            {canEdit(row) && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTx(row)}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
                            {canDelete(row) && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteTx(row)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-muted-foreground py-10">Chưa có dữ liệu</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditTransactionDialog transaction={editTx} open={!!editTx} onOpenChange={open => { if (!open) setEditTx(null); }} onSaved={handleRefresh} />

      <AlertDialog open={!!deleteTx} onOpenChange={open => { if (!open) setDeleteTx(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              {approvedIds.has(deleteTx?.voucherNo || '')
                ? 'Chứng từ đã duyệt chỉ Admin mới được xóa. Thao tác này không thể hoàn tác.'
                : 'Bạn có chắc chắn muốn xóa chứng từ này? Thao tác này không thể hoàn tác.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTx(null)}>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="print-only hidden">
        <PrintDetailLedger refreshKey={refreshKey} />
      </div>
    </>
  );
}

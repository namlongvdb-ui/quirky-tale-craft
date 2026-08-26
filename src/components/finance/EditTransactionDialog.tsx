import { useState, useEffect } from 'react';
import { Transaction } from '@/types/finance';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { transactionsApi } from '@/lib/api-client';
import { toast } from 'sonner';

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const typeLabels: Record<string, string> = {
  thu: 'Phiếu Thu',
  chi: 'Phiếu Chi',
  'tham-hoi': 'Phiếu Thăm Hỏi',
  'de-nghi': 'Đề Nghị Thanh Toán',
};

export function EditTransactionDialog({ transaction, open, onOpenChange, onSaved }: EditTransactionDialogProps) {
  const [form, setForm] = useState({
    date: '', voucherNo: '', amount: '', description: '',
    personName: '', department: '', accountCode: '', approver: '',
  });

  useEffect(() => {
    if (transaction) {
      setForm({
        date: transaction.date, voucherNo: transaction.voucherNo,
        amount: String(transaction.amount), description: transaction.description,
        personName: transaction.personName, department: transaction.department,
        accountCode: transaction.accountCode, approver: transaction.approver,
      });
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction) return;
    const amount = parseInt(form.amount) || 0;
    if (amount <= 0 || !form.description) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    const { error } = await transactionsApi.update(transaction.id, {
      date: form.date, voucherNo: form.voucherNo, amount,
      description: form.description, personName: form.personName,
      department: form.department, accountCode: form.accountCode, approver: form.approver,
    });
    if (error) {
      toast.error('Lỗi cập nhật: ' + error.message);
      return;
    }
    toast.success(`Đã cập nhật ${form.voucherNo}`);
    onOpenChange(false);
    onSaved();
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa {typeLabels[transaction.type] || 'chứng từ'} - {form.voucherNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Ngày</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label className="text-xs text-muted-foreground">Số CT</Label><Input value={form.voucherNo} onChange={e => setForm({ ...form, voucherNo: e.target.value })} /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Số tiền (VNĐ)</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label className="text-xs text-muted-foreground">Nội dung</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div><Label className="text-xs text-muted-foreground">Họ tên</Label><Input value={form.personName} onChange={e => setForm({ ...form, personName: e.target.value })} /></div>
          <div><Label className="text-xs text-muted-foreground">Đơn vị</Label><Input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Mã TK</Label><Input value={form.accountCode} onChange={e => setForm({ ...form, accountCode: e.target.value })} /></div>
            <div><Label className="text-xs text-muted-foreground">Người duyệt</Label><Input value={form.approver} onChange={e => setForm({ ...form, approver: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave}>Lưu thay đổi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

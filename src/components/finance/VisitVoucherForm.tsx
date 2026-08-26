import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addTransaction, updateTransaction, getNextVoucherNo, numberToVietnameseWords, getOrgSettings } from '@/lib/finance-store';
import { Transaction } from '@/types/finance';
import { Heart, Printer, Save, X, DollarSign, User, CalendarDays, Hash, History, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PrintVisitVoucher } from './PrintVisitVoucher';
import { TransactionList } from './TransactionList';
import { VoucherAttachments } from './VoucherAttachments';
import { useAuth } from '@/hooks/useAuth';
import { submitVoucherForSigning, notifySigners, getVoucherLabel } from '@/lib/notification-utils';

interface VisitVoucherFormProps {
  onSaved?: () => void;
  refreshKey?: number;
}

function DepartmentCombobox({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o => o.toLowerCase().includes(value.toLowerCase()));

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Chọn hoặc nhập đơn vị..."
        className="h-11"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-40 overflow-auto">
          {filtered.map(opt => (
            <div
              key={opt}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
              onMouseDown={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyForm = (settings: ReturnType<typeof getOrgSettings>) => ({
  date: new Date().toISOString().split('T')[0],
  voucherNo: getNextVoucherNo('tham-hoi'),
  visitorDepartment: settings.unionGroups[0]?.name || '',
  recipientName: '',
  reason: '',
  amount: '',
  unionGroupName: settings.unionGroups[0]?.name || '',
});

export function VisitVoucherForm({ onSaved, refreshKey }: VisitVoucherFormProps) {
  const { user, profile } = useAuth();
  const settings = getOrgSettings();
  const [form, setForm] = useState(() => emptyForm(settings));
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const amount = parseInt(form.amount) || 0;

  const handleSelectForEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      date: tx.date,
      voucherNo: tx.voucherNo,
      visitorDepartment: tx.department,
      recipientName: tx.recipientName || tx.personName,
      reason: tx.reason || tx.description,
      amount: tx.amount.toString(),
      unionGroupName: tx.department || settings.unionGroups[0]?.name || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTx(null);
    setForm(emptyForm(settings));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.recipientName || !form.reason || amount <= 0) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (editingTx) {
      updateTransaction(editingTx.id, {
        date: form.date,
        voucherNo: form.voucherNo,
        type: 'tham-hoi',
        amount,
        description: form.reason,
        personName: form.recipientName,
        department: form.unionGroupName,
        recipientName: form.recipientName,
        reason: form.reason,
      });
      toast.success(`Phiếu thăm hỏi ${form.voucherNo} đã được cập nhật`);
      setEditingTx(null);
    } else {
      const txData = {
        date: form.date,
        voucherNo: form.voucherNo,
        type: 'tham-hoi' as const,
        amount,
        description: form.reason,
        personName: form.recipientName,
        department: form.unionGroupName,
        accountCode: '',
        approver: settings.unionGroups[0]?.leaderName || '',
        attachments: 0,
        recipientName: form.recipientName,
        reason: form.reason,
        createdBy: user?.id,
      };
      addTransaction(txData);

      if (user) {
        submitVoucherForSigning(form.voucherNo, 'tham-hoi', txData, user.id);
        notifySigners(form.voucherNo, 'tham-hoi', getVoucherLabel('tham-hoi'), profile?.full_name || 'Kế toán', form.unionGroupName);
      }

      toast.success(`Phiếu thăm hỏi ${form.voucherNo} đã được lưu`);
    }

    setForm(emptyForm(settings));
    onSaved?.();
  };

  return (
    <>
      <div className="no-print grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* LEFT: form */}
        <div>
          {/* Page header */}
          <div className="flex items-center gap-4 mb-5">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl ring-1 bg-rose-50 ring-rose-200 dark:bg-rose-950/40 dark:ring-rose-800">
              <Heart className="h-7 w-7 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">PHIẾU THĂM HỎI</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800">
                  Thăm hỏi đoàn viên
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-serif">
                  {editingTx ? `Đang sửa phiếu ${editingTx.voucherNo}` : 'Chăm lo đời sống đoàn viên'}
                </span>
              </div>
            </div>
          </div>

          <Card className={`rounded-2xl shadow-sm border-0 ring-1 overflow-hidden ${editingTx ? 'ring-amber-300 dark:ring-amber-700' : 'ring-border'}`}>
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Meta panel */}
                <div className="rounded-xl bg-muted/40 ring-1 ring-border p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" /> Ngày lập phiếu
                      </Label>
                      <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-10 bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Số hiệu chứng từ
                      </Label>
                      <div className="relative">
                        <Input value={form.voucherNo} onChange={e => setForm({ ...form, voucherNo: e.target.value })} className="h-10 bg-background font-mono font-semibold pr-9" />
                        <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Union group */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Đơn vị thăm hỏi</Label>
                  <DepartmentCombobox
                    value={form.unionGroupName}
                    onChange={val => setForm({ ...form, unionGroupName: val, visitorDepartment: val })}
                    options={settings.unionGroups.map(g => g.name)}
                  />
                </div>

                {/* Recipient */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Đối tượng được thăm hỏi (đoàn viên)</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={form.recipientName} onChange={e => setForm({ ...form, recipientName: e.target.value })} placeholder="Nhập họ tên đoàn viên được thăm hỏi..." className="h-11 pl-9" />
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Lý do thăm hỏi chi tiết</Label>
                  <Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Ghi rõ nội dung (VD: Thăm hỏi đoàn viên ốm nằm viện điều trị tại BV...)" rows={3} className="resize-none" />
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Số tiền chi (VNĐ)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" className="h-11 pl-9 text-lg font-serif font-bold tracking-wide" />
                  </div>
                </div>

                {amount > 0 && (
                  <div className="rounded-xl p-3.5 ring-1 bg-rose-50/60 ring-rose-200 dark:bg-rose-950/20 dark:ring-rose-800">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Bằng chữ</p>
                    <p className="font-medium text-foreground italic text-sm">{numberToVietnameseWords(amount)}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="submit"
                    size="lg"
                    className={`flex-1 h-12 text-sm font-semibold uppercase tracking-widest shadow-md ${editingTx ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingTx ? 'Cập nhật phiếu thăm hỏi' : 'Xác nhận & lưu phiếu'}
                  </Button>
                  {editingTx && (
                    <Button type="button" variant="outline" className="h-12 w-12" onClick={handleCancelEdit} title="Hủy sửa">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" variant="outline" className="h-12 w-12" title="In phiếu" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <VoucherAttachments voucherType="tham-hoi" voucherId={form.voucherNo} />
        </div>

        {/* RIGHT: recent vouchers */}
        <aside className="xl:sticky xl:top-4">
          <div className="flex items-center gap-2 mb-4 px-1">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-serif text-lg font-semibold text-foreground">Phiếu gần đây</h2>
          </div>
          <TransactionList
            type="tham-hoi"
            title="PHIẾU THĂM HỎI"
            personLabel="Người được thăm hỏi"
            onChanged={onSaved}
            refreshKey={refreshKey}
            onSelectForEdit={handleSelectForEdit}
            containerClassName="max-w-none mx-0 mt-0"
          />
        </aside>
      </div>

      <div className="print-only hidden">
        <PrintVisitVoucher data={{
          date: form.date,
          visitorDepartment: form.visitorDepartment,
          recipientName: form.recipientName,
          reason: form.reason,
          amount,
          unionGroupName: form.unionGroupName,
        }} />
      </div>
    </>
  );
}

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addTransaction, updateTransaction, getNextVoucherNo, numberToVietnameseWords, getOrgSettings } from '@/lib/finance-store';
import { Transaction } from '@/types/finance';
import { FileText, Printer, Save, X, DollarSign, User, CreditCard, CalendarDays, Hash, History, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { PrintPaymentRequest } from './PrintPaymentRequest';
import { TransactionList } from './TransactionList';
import { VoucherAttachments } from './VoucherAttachments';
import { useAuth } from '@/hooks/useAuth';
import { submitVoucherForSigning, notifySigners, getVoucherLabel } from '@/lib/notification-utils';

interface PaymentRequestFormProps {
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
  voucherNo: getNextVoucherNo('de-nghi'),
  requestNo: '',
  requesterName: '',
  department: settings.unionGroups[0]?.name || '',
  content: '',
  amount: '',
  times: '',
  bankAccount: '',
  bankAccountName: '',
  bankName: '',
  attachments: '',
});

export function PaymentRequestForm({ onSaved, refreshKey }: PaymentRequestFormProps) {
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
      requestNo: '',
      requesterName: tx.personName,
      department: tx.department,
      content: tx.description,
      amount: tx.amount.toString(),
      times: tx.times || '',
      bankAccount: tx.bankAccount || '',
      bankAccountName: tx.bankAccountName || '',
      bankName: tx.bankName || '',
      attachments: tx.attachments?.toString() || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTx(null);
    setForm(emptyForm(settings));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.requesterName || !form.content || amount <= 0) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (editingTx) {
      updateTransaction(editingTx.id, {
        date: form.date,
        voucherNo: form.voucherNo,
        type: 'de-nghi',
        amount,
        description: form.content,
        personName: form.requesterName,
        department: form.department,
        attachments: parseInt(form.attachments) || 0,
        bankAccount: form.bankAccount,
        bankAccountName: form.bankAccountName,
        bankName: form.bankName,
        times: form.times,
      });
      toast.success(`Đề nghị thanh toán ${form.voucherNo} đã được cập nhật`);
      setEditingTx(null);
    } else {
      const txData = {
        date: form.date,
        voucherNo: form.voucherNo,
        type: 'de-nghi' as const,
        amount,
        description: form.content,
        personName: form.requesterName,
        department: form.department,
        accountCode: '',
        approver: settings.unionGroups[0]?.leaderName || '',
        attachments: parseInt(form.attachments) || 0,
        bankAccount: form.bankAccount,
        bankAccountName: form.bankAccountName,
        bankName: form.bankName,
        times: form.times,
        createdBy: user?.id,
      };
      addTransaction(txData);

      if (user) {
        submitVoucherForSigning(form.voucherNo, 'de-nghi', txData, user.id);
        notifySigners(form.voucherNo, 'de-nghi', getVoucherLabel('de-nghi'), profile?.full_name || 'Kế toán');
      }

      toast.success(`Đề nghị thanh toán ${form.voucherNo} đã được lưu`);
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
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl ring-1 bg-violet-50 ring-violet-200 dark:bg-violet-950/40 dark:ring-violet-800">
              <FileText className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">ĐỀ NGHỊ THANH TOÁN</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800">
                  Chứng từ thanh toán
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-serif">
                  {editingTx ? `Đang sửa phiếu ${editingTx.voucherNo}` : 'Thanh toán các khoản chi'}
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
                        <CalendarDays className="h-3.5 w-3.5" /> Ngày lập đề nghị
                      </Label>
                      <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-10 bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Số hiệu chứng từ
                      </Label>
                      <div className="relative">
                        <Input value={form.voucherNo} onChange={e => setForm({ ...form, voucherNo: e.target.value })} className="h-10 bg-background font-mono font-semibold pr-9" />
                        <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-violet-400" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Requester + department */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Người đề nghị thanh toán</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={form.requesterName} onChange={e => setForm({ ...form, requesterName: e.target.value })} placeholder="Họ tên người đề nghị..." className="h-11 pl-9" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Đơn vị / tổ công đoàn</Label>
                    <DepartmentCombobox
                      value={form.department}
                      onChange={val => setForm({ ...form, department: val })}
                      options={settings.unionGroups.map(g => g.name)}
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Nội dung thanh toán chi tiết</Label>
                  <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Ghi rõ nội dung thanh toán (VD: Thanh toán tiền mua quà thăm hỏi đ/c...)" rows={3} className="resize-none" />
                </div>

                {/* Amount + times */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Số tiền thanh toán (VNĐ)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" className="h-11 pl-9 text-lg font-serif font-bold tracking-wide" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Lần chi thứ</Label>
                    <Input value={form.times} onChange={e => setForm({ ...form, times: e.target.value })} placeholder="VD: 01, 02..." className="h-11 text-center font-mono" />
                  </div>
                </div>

                {amount > 0 && (
                  <div className="rounded-xl p-3.5 ring-1 bg-violet-50/60 ring-violet-200 dark:bg-violet-950/20 dark:ring-violet-800">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Viết bằng chữ</p>
                    <p className="font-medium text-foreground italic text-sm">{numberToVietnameseWords(amount)}</p>
                  </div>
                )}

                {/* Bank info */}
                <div className="rounded-xl ring-1 ring-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Thông tin nhận tiền (nếu chuyển khoản)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Số TK</Label>
                      <Input value={form.bankAccount} onChange={e => setForm({ ...form, bankAccount: e.target.value })} placeholder="Số tài khoản..." className="h-10 bg-background font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Tên TK</Label>
                      <Input value={form.bankAccountName} onChange={e => setForm({ ...form, bankAccountName: e.target.value })} placeholder="Tên chủ tài khoản..." className="h-10 bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Tại NH</Label>
                      <Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="Tên ngân hàng..." className="h-10 bg-background" />
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Kèm theo chứng từ gốc (số tờ)</Label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={form.attachments} onChange={e => setForm({ ...form, attachments: e.target.value })} placeholder="Số lượng chứng từ gốc kèm theo..." className="h-11 pl-9" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="submit"
                    size="lg"
                    className={`flex-1 h-12 text-sm font-semibold uppercase tracking-widest shadow-md ${editingTx ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'}`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingTx ? 'Cập nhật đề nghị thanh toán' : 'Xác nhận & lưu phiếu'}
                  </Button>
                  {editingTx && (
                    <Button type="button" variant="outline" className="h-12 w-12" onClick={handleCancelEdit} title="Hủy sửa">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button type="button" variant="outline" className="h-12 w-12" title="In giấy đề nghị" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <VoucherAttachments voucherType="de-nghi" voucherId={form.voucherNo} />
        </div>

        {/* RIGHT: recent requests */}
        <aside className="xl:sticky xl:top-4">
          <div className="flex items-center gap-2 mb-4 px-1">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-serif text-lg font-semibold text-foreground">Đề nghị gần đây</h2>
          </div>
          <TransactionList
            type="de-nghi"
            title="GIẤY ĐỀ NGHỊ THANH TOÁN"
            personLabel="Người đề nghị"
            onChanged={onSaved}
            refreshKey={refreshKey}
            onSelectForEdit={handleSelectForEdit}
            containerClassName="max-w-none mx-0 mt-0"
          />
        </aside>
      </div>

      <div className="print-only hidden">
        <PrintPaymentRequest data={{
          date: form.date,
          requestNo: form.requestNo,
          requesterName: form.requesterName,
          department: form.department,
          content: form.content,
          amount,
          times: form.times,
          bankAccount: form.bankAccount,
          bankAccountName: form.bankAccountName,
          bankName: form.bankName,
          attachments: form.attachments,
        }} />
      </div>
    </>
  );
}

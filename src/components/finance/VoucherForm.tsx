import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addTransaction, updateTransaction, getNextVoucherNo, numberToVietnameseWords, getOrgSettings } from '@/lib/finance-store';
import { Transaction } from '@/types/finance';
import { Save, Printer, X, DollarSign, User, Hash, CalendarDays, BookOpen, History, TrendingUp, TrendingDown } from 'lucide-react';
import { AccountCodeInput } from './AccountCodeInput';
import { toast } from 'sonner';
import { PrintVoucher } from './PrintVoucher';
import { VoucherList } from './VoucherList';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { submitVoucherForSigning, notifySigners, getVoucherLabel } from '@/lib/notification-utils';

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
        className="h-10"
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

interface VoucherFormProps {
  type: 'thu' | 'chi';
  onSaved?: () => void;
  refreshKey?: number;
}

const emptyForm = (type: 'thu' | 'chi', settings: ReturnType<typeof getOrgSettings>) => ({
  date: new Date().toISOString().split('T')[0],
  voucherNo: getNextVoucherNo(type),
  amount: '',
  description: '',
  personName: '',
  department: '',
  accountCode: settings.defaultAccountCode,
  approver: settings.leaderName,
  attachments: 1,
});

export function VoucherForm({ type, onSaved, refreshKey }: VoucherFormProps) {
  const { user, profile } = useAuth();
  const title = type === 'thu' ? 'PHIẾU THU' : 'PHIẾU CHI';
  const settings = getOrgSettings();

  const [form, setForm] = useState(() => emptyForm(type, settings));
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [printSignatures, setPrintSignatures] = useState<{ signer_name: string; role: string; signed_at: string }[]>([]);

  const amount = parseInt(form.amount) || 0;

  const fetchSignaturesForPrint = useCallback(async (voucherNo: string) => {
    const { data: sigs } = await supabase
      .from('voucher_signatures')
      .select('signer_id, signed_at')
      .eq('voucher_id', voucherNo)
      .eq('voucher_type', type);

    if (!sigs || sigs.length === 0) {
      setPrintSignatures([]);
      return;
    }

    const { fetchDirectoryProfiles, fetchDirectoryUserRoles } = await import('@/lib/directory');
    const [profiles, roles] = await Promise.all([
      fetchDirectoryProfiles(),
      fetchDirectoryUserRoles(),
    ]);

    setPrintSignatures(sigs.map(s => {
      const profile = profiles.find(p => p.user_id === s.signer_id);
      const role = roles.find(r => r.user_id === s.signer_id);
      return {
        signer_name: profile?.full_name || 'Unknown',
        role: role?.role || '',
        signed_at: s.signed_at,
      };
    }));
  }, [type]);

  useEffect(() => {
    setForm(emptyForm(type, settings));
    setEditingTx(null);
  }, [type]);

  const handleSelectForEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      date: tx.date,
      voucherNo: tx.voucherNo,
      amount: tx.amount.toString(),
      description: tx.description,
      personName: tx.personName,
      department: tx.department,
      accountCode: tx.accountCode,
      approver: tx.approver,
      attachments: tx.attachments,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTx(null);
    setForm(emptyForm(type, settings));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personName || !form.description || amount <= 0) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    if (editingTx) {
      updateTransaction(editingTx.id, {
        date: form.date,
        voucherNo: form.voucherNo,
        type,
        amount,
        description: form.description,
        personName: form.personName,
        department: form.department,
        accountCode: form.accountCode,
        approver: form.approver,
        attachments: form.attachments,
      });
      toast.success(`${title} ${form.voucherNo} đã được cập nhật`);
      setEditingTx(null);
    } else {
      const txData = {
        date: form.date,
        voucherNo: form.voucherNo,
        type,
        amount,
        description: form.description,
        personName: form.personName,
        department: form.department,
        accountCode: form.accountCode,
        approver: form.approver,
        attachments: form.attachments,
        createdBy: user?.id,
      };
      addTransaction(txData);
      
      // Submit for signing and notify signers
      if (user) {
        submitVoucherForSigning(form.voucherNo, type, txData, user.id);
        notifySigners(form.voucherNo, type, getVoucherLabel(type), profile?.full_name || 'Kế toán');
      }
      
      toast.success(`${title} ${form.voucherNo} đã được lưu`);
    }

    setForm(emptyForm(type, settings));
    onSaved?.();
  };

  const isThu = type === 'thu';
  const TrendIcon = isThu ? TrendingUp : TrendingDown;


  return (
    <>
      <div className="no-print grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        {/* LEFT: form */}
        <div>
          {/* Page header */}
          <div className="flex items-center gap-4 mb-5">
            <div className={`inline-flex items-center justify-center h-14 w-14 rounded-2xl ring-1 ${isThu ? 'bg-emerald-50 ring-emerald-200 dark:bg-emerald-950/40 dark:ring-emerald-800' : 'bg-blue-50 ring-blue-200 dark:bg-blue-950/40 dark:ring-blue-800'}`}>
              <TrendIcon className={`h-7 w-7 ${isThu ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${isThu ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800'}`}>
                  Tài chính công đoàn
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-serif">
                  {editingTx ? `Đang sửa phiếu ${editingTx.voucherNo}` : 'Ghi nhận giao dịch'}
                </span>
              </div>
            </div>
          </div>

          <Card className={`rounded-2xl shadow-sm border-0 ring-1 overflow-hidden ${editingTx ? 'ring-amber-300 dark:ring-amber-700' : 'ring-border'}`}>
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Meta panel */}
                <div className="rounded-xl bg-muted/40 ring-1 ring-border p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" /> Ngày lập
                      </Label>
                      <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-10 bg-background" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Số hiệu
                      </Label>
                      <Input value={form.voucherNo} onChange={e => setForm({ ...form, voucherNo: e.target.value })} className="h-10 bg-background font-mono font-semibold" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                        <BookOpen className="h-3.5 w-3.5" /> Hạch toán kế toán
                      </Label>
                      <div className="flex items-center gap-2 h-10 rounded-md bg-background ring-1 ring-input px-2">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {type === 'chi' ? 'Có' : 'Nợ'}
                        </span>
                        <span className="font-mono font-semibold text-primary">111</span>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-1">
                          {type === 'chi' ? 'Nợ' : 'Có'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <AccountCodeInput
                            value={form.accountCode}
                            onChange={code => setForm({ ...form, accountCode: code })}
                            placeholder={settings.defaultAccountCode || 'Nhập mã TK...'}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Person */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Đối tượng giao dịch (người {isThu ? 'nộp' : 'nhận'})
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={form.personName} onChange={e => setForm({ ...form, personName: e.target.value })} placeholder="Nhập họ tên hoặc chọn từ danh sách..." className="h-11 pl-9" />
                  </div>
                </div>

                {/* Department + amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Đơn vị / bộ phận</Label>
                    <DepartmentCombobox
                      value={form.department}
                      onChange={(val) => setForm({ ...form, department: val })}
                      options={settings.unionGroups.map(g => g.name)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Số tiền giao dịch (VNĐ)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" className="h-11 pl-9 text-lg font-serif font-bold tracking-wide" />
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Nội dung {isThu ? 'thu' : 'chi'}</Label>
                  <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ghi rõ lý do thu/chi..." rows={3} className="resize-none" />
                </div>

                {amount > 0 && (
                  <div className={`rounded-xl p-3.5 ring-1 ${isThu ? 'bg-emerald-50/60 ring-emerald-200 dark:bg-emerald-950/20 dark:ring-emerald-800' : 'bg-blue-50/60 ring-blue-200 dark:bg-blue-950/20 dark:ring-blue-800'}`}>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Viết bằng chữ</p>
                    <p className="font-medium text-foreground italic text-sm">{numberToVietnameseWords(amount)}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="submit"
                    size="lg"
                    className={`flex-1 h-12 text-sm font-semibold uppercase tracking-widest shadow-md ${editingTx ? 'bg-amber-600 hover:bg-amber-700 text-white' : isThu ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingTx ? `Cập nhật ${title.toLowerCase()}` : 'Xác nhận & lưu phiếu'}
                  </Button>
                  {editingTx && (
                    <Button type="button" variant="outline" className="h-12 w-12" onClick={handleCancelEdit} title="Hủy sửa">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-12"
                    title="In phiếu"
                    onClick={async () => {
                      await fetchSignaturesForPrint(form.voucherNo);
                      setTimeout(() => window.print(), 200);
                    }}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: recent vouchers */}
        <aside className="xl:sticky xl:top-4">
          <div className="flex items-center gap-2 mb-4 px-1">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-serif text-lg font-semibold text-foreground">Phiếu gần đây</h2>
          </div>
          <VoucherList
            type={type}
            onChanged={onSaved}
            refreshKey={refreshKey}
            onSelectForEdit={handleSelectForEdit}
            containerClassName="max-w-none mx-0 mt-0"
          />
        </aside>
      </div>

      <div className="print-only hidden">
        <PrintVoucher
          type={type}
          data={{
            date: form.date,
            voucherNo: form.voucherNo,
            amount,
            description: form.description,
            personName: form.personName,
            department: form.department,
            accountCode: form.accountCode,
            approver: form.approver,
            attachments: form.attachments,
          }}
          signatures={printSignatures}
        />
      </div>
    </>
  );
}

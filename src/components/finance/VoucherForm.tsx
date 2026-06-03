import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addTransaction, updateTransaction, getNextVoucherNo, numberToVietnameseWords, getOrgSettings } from '@/lib/finance-store';
import { Transaction } from '@/types/finance';
import { FileText, Save, Printer, X, DollarSign, User, Building2, Hash } from 'lucide-react';
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

  return (
    <>
      <Card className="max-w-3xl mx-auto shadow-lg no-print overflow-hidden border-0 ring-1 ring-border">
        {/* Header */}
        <CardHeader className={`relative py-5 ${editingTx ? 'bg-amber-50 dark:bg-amber-950/30 border-b-2 border-amber-300 dark:border-amber-700' : isThu ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-b-2 border-emerald-200 dark:border-emerald-800' : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-b-2 border-blue-200 dark:border-blue-800'}`}>
          <div className="flex items-center gap-2 absolute right-4 top-4">
            {editingTx && (
              <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit} className="bg-background/80 backdrop-blur-sm">
                <X className="h-4 w-4 mr-1" /> Hủy sửa
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={async () => {
              await fetchSignaturesForPrint(form.voucherNo);
              setTimeout(() => window.print(), 200);
            }} className="bg-background/80 backdrop-blur-sm">
              <Printer className="h-4 w-4 mr-1" /> In phiếu
            </Button>
          </div>
          <div className="text-center">
            <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl mb-2 ${isThu ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
              <FileText className={`h-6 w-6 ${isThu ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
            </div>
            <CardTitle className="text-xl font-bold text-foreground">
              {editingTx ? `Sửa ${title.toLowerCase()}` : title}
            </CardTitle>
            {editingTx && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 font-medium">
                Đang sửa phiếu {editingTx.voucherNo}
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Row 1: Date, Voucher No, Account codes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">Ngày</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">Số CT</Label>
                <Input value={form.voucherNo} onChange={e => setForm({ ...form, voucherNo: e.target.value })} className="h-10 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">TK {type === 'chi' ? 'Có' : 'Nợ'}</Label>
                <Input value="111" disabled className="h-10 bg-muted/60 font-semibold font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs font-medium">TK {type === 'chi' ? 'Nợ' : 'Có'}</Label>
                <AccountCodeInput
                  value={form.accountCode}
                  onChange={code => setForm({ ...form, accountCode: code })}
                  placeholder={settings.defaultAccountCode || 'Chọn TK...'}
                />
              </div>
            </div>

            {/* Person name */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Họ và tên người {type === 'thu' ? 'nộp' : 'nhận'} tiền
              </Label>
              <Input value={form.personName} onChange={e => setForm({ ...form, personName: e.target.value })} placeholder="Nhập họ tên..." className="h-10" />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Đơn vị
              </Label>
              <DepartmentCombobox
                value={form.department}
                onChange={(val) => setForm({ ...form, department: val })}
                options={settings.unionGroups.map(g => g.name)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium">Nội dung</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Nội dung chi tiết..." rows={2} className="resize-none" />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs font-medium flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Số tiền (VNĐ)
              </Label>
              <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" className="h-12 text-xl font-bold tracking-wide" />
            </div>

            {amount > 0 && (
              <div className={`rounded-lg p-3.5 ${isThu ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800' : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'}`}>
                <p className="text-xs text-muted-foreground mb-0.5">Viết bằng chữ:</p>
                <p className="font-medium text-foreground italic text-sm">{numberToVietnameseWords(amount)}</p>
              </div>
            )}

            <Button type="submit" className={`w-full h-11 text-base font-semibold ${editingTx ? 'bg-amber-600 hover:bg-amber-700' : ''}`} size="lg">
              <Save className="h-4 w-4 mr-2" /> {editingTx ? `Cập nhật ${title}` : `Lưu ${title}`}
            </Button>
          </form>
        </CardContent>
      </Card>

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

      <VoucherList type={type} onChanged={onSaved} refreshKey={refreshKey} onSelectForEdit={handleSelectForEdit} />
    </>
  );
}

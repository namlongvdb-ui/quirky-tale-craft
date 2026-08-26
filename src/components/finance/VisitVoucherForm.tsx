import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { numberToVietnameseWords } from '@/lib/finance-store';
import { Transaction } from '@/types/finance';
import { FileText, Save, Printer, X, DollarSign, User, Building2, Sparkles, ChevronRight, History, Search, TrendingUp, TrendingDown, AlertTriangle, Calendar, Hash } from 'lucide-react';
import { AccountCodeInput } from './AccountCodeInput';
import { toast } from 'sonner';
import { PrintVoucher } from './PrintVoucher';
import { VoucherList } from './VoucherList';
import { voucherSignaturesApi, profilesApi, rolesApi, pendingVouchersApi } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { submitVoucherForSigningWithNotify } from '@/lib/signing-flow';
import { useOrgSettings, useTransactions } from '@/hooks/useFinanceData';
import { useStaffList } from '@/hooks/useStaffData';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

function DepartmentCombobox({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [open, setOpen] = useState(false);
  const filtered = value && !options.includes(value) 
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options;

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Chọn hoặc nhập đơn vị..."
        className="h-10 bg-muted/20 border-2 focus:border-primary transition-all rounded-xl"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border-2 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {filtered.map(opt => (
            <div
              key={opt}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors border-b last:border-0"
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

export function VoucherForm({ type, onSaved, refreshKey }: VoucherFormProps) {
  const { user, profile, hasRole, isAdmin } = useAuth();
  const title = type === 'thu' ? 'PHIẾU THU' : 'PHIẾU CHI';
  const { settings } = useOrgSettings();
  const { addTransaction, updateTransaction, deleteTransaction, getNextVoucherNo, transactions } = useTransactions(undefined, type, refreshKey);
  const { list: staffList } = useStaffList();

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    voucherNo: '',
    amount: '',
    description: '',
    personName: '',
    department: '',
    accountCode: settings.defaultAccountCode,
    approver: settings.leaderName,
    attachments: 1,
  });
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [printSignatures, setPrintSignatures] = useState<{ signer_name: string; role: string; signed_at: string }[]>([]);
  const [showStaffSuggestions, setShowStaffSuggestions] = useState(false);
  const [filteredStaff, setFilteredStaff] = useState<any[]>([]);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const amount = parseInt(form.amount) || 0;
  const canPrepareThuChi = hasRole('ke_toan') || isAdmin;
  const isThu = type === 'thu';

  // Load next voucher number
  useEffect(() => {
    getNextVoucherNo(type).then(no => {
      if (no) setForm(f => ({ ...f, voucherNo: no }));
    });
  }, [type, getNextVoucherNo]);

  // Update defaults when settings load
  useEffect(() => {
    if (settings.unionGroups.length > 0) {
      setForm(f => ({
        ...f,
        accountCode: f.accountCode || settings.defaultAccountCode,
        approver: f.approver || settings.leaderName,
      }));
    }
  }, [settings]);

  // Xử lý gợi ý đoàn viên
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowStaffSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStaffSearch = (val: string) => {
    setForm({ ...form, personName: val });
    if (val.trim().length > 0) {
      const filtered = staffList.filter(s => 
        s.fullName.toLowerCase().includes(val.toLowerCase()) ||
        (s.department && s.department.toLowerCase().includes(val.toLowerCase()))
      ).slice(0, 5);
      setFilteredStaff(filtered);
      setShowStaffSuggestions(true);
    } else {
      setShowStaffSuggestions(false);
    }
  };

  const selectStaff = (staff: any) => {
    setForm({ 
      ...form, 
      personName: staff.fullName,
      department: staff.department || form.department 
    });
    setShowStaffSuggestions(false);
  };

  const fetchSignaturesForPrint = useCallback(async (voucherNo: string) => {
    const { data: sigs } = await voucherSignaturesApi.get(voucherNo, type);
    if (!sigs || sigs.length === 0) { setPrintSignatures([]); return; }
    const [profilesRes, rolesRes] = await Promise.all([profilesApi.getAll(), rolesApi.getAll()]);
    setPrintSignatures(sigs.map((s: any) => {
      const p = profilesRes.data?.find((pr: any) => pr.user_id === s.signer_id);
      const r = rolesRes.data?.find((ro: any) => ro.user_id === s.signer_id);
      return { signer_name: p?.full_name || 'Unknown', role: r?.role || '', signed_at: s.signed_at };
    }));
  }, [type]);

  const handleSelectForEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      date: tx.date, voucherNo: tx.voucherNo, amount: tx.amount.toString(),
      description: tx.description, personName: tx.personName, department: tx.department,
      accountCode: tx.accountCode, approver: tx.approver, attachments: tx.attachments,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = async () => {
    setEditingTx(null);
    const no = await getNextVoucherNo(type);
    setForm({
      date: new Date().toISOString().split('T')[0], voucherNo: no || '',
      amount: '', description: '', personName: '', department: '',
      accountCode: settings.defaultAccountCode, approver: settings.leaderName, attachments: 1,
    });
  };

  const validateForm = () => {
    if (!form.personName || !form.description || amount <= 0) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return false;
    }
    return true;
  };

  const performSave = async (): Promise<{ success: boolean; savedTx?: Transaction }> => {
    if (!validateForm()) return { success: false };

    try {
      if (editingTx) {
        await updateTransaction(editingTx.id, {
          date: form.date, voucherNo: form.voucherNo, type, amount,
          description: form.description, personName: form.personName, department: form.department,
          accountCode: form.accountCode, approver: form.approver, attachments: form.attachments,
        });
        toast.success(`${title} ${form.voucherNo} đã được cập nhật`);
        return { success: true, savedTx: { ...editingTx, ...form, amount, type } as Transaction };
      } else {
        if (!canPrepareThuChi) {
          toast.error('Chỉ kế toán được lập phiếu thu / phiếu chi');
          return { success: false };
        }
        const txData = {
          date: form.date, voucherNo: form.voucherNo, type, amount,
          description: form.description, personName: form.personName, department: form.department,
          accountCode: form.accountCode, approver: form.approver, attachments: form.attachments,
          createdBy: user?.id,
        };
        const created = await addTransaction(txData as any);
        if (user) {
          try {
            await submitVoucherForSigningWithNotify({
              voucherId: form.voucherNo,
              voucherType: type,
              voucherData: txData as Record<string, unknown>,
              createdBy: user.id,
              creatorName: profile?.full_name || 'Kế toán',
            });
          } catch {
            if (created?.id) await deleteTransaction(created.id);
            const { data: pendings } = await pendingVouchersApi.getAll();
            const orphan = (pendings || []).find(
              (v: { voucher_id: string; voucher_type: string; id: string }) =>
                v.voucher_id === form.voucherNo && v.voucher_type === type
            );
            if (orphan?.id) await pendingVouchersApi.delete(orphan.id);
            return { success: false };
          }
        }
        toast.success(`${title} ${form.voucherNo} đã được lưu và gửi lãnh đạo ký duyệt`);
        return { success: true, savedTx: created as Transaction };
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu chứng từ');
      return { success: false };
    }
  };

  const resetFormAfterSave = async () => {
    setEditingTx(null);
    const no = await getNextVoucherNo(type);
    setForm({
      date: new Date().toISOString().split('T')[0], voucherNo: no || '',
      amount: '', description: '', personName: '', department: '',
      accountCode: settings.defaultAccountCode, approver: settings.leaderName, attachments: 1,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { success } = await performSave();
    if (success) {
      await resetFormAfterSave();
      onSaved?.();
    }
  };

  const handlePrint = async () => {
    if (!editingTx) {
      const { success, savedTx } = await performSave();
      if (!success) return;
      if (savedTx) setEditingTx(savedTx);
      onSaved?.();
    } else {
      const { success } = await performSave();
      if (!success) return;
    }
    await fetchSignaturesForPrint(form.voucherNo);
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Cột trái: Form nhập liệu */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300",
              isThu ? "bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100" : "bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100"
            )}>
              {isThu ? <TrendingUp className="h-7 w-7" /> : <TrendingDown className="h-7 w-7" />}
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight">{title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0 border-2", isThu ? "text-emerald-600 border-emerald-100 bg-emerald-50/30" : "text-indigo-600 border-indigo-100 bg-indigo-50/30")}>
                  Tài chính công đoàn
                </Badge>
                <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-tighter opacity-60">Ghi nhận giao dịch</span>
              </div>
            </div>
          </div>
          {editingTx && (
            <Button variant="ghost" onClick={handleCancelEdit} className="text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl h-9">
              <X className="h-4 w-4 mr-2" /> Hủy chỉnh sửa
            </Button>
          )}
        </div>

        <Card className="border-border shadow-2xl shadow-primary/5 overflow-hidden rounded-3xl border-2 transition-all duration-500 hover:shadow-primary/10">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Header Info Section: Date, Voucher No, Accounting Codes */}
              <div className="bg-muted/10 border border-muted/20 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-12 gap-5 shadow-inner items-end">
                {/* Ngày chứng từ - Ngắn hơn */}
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center gap-2 ml-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Ngày lập</Label>
                  </div>
                  <Input 
                    type="date" 
                    value={form.date} 
                    onChange={e => setForm({ ...form, date: e.target.value })} 
                    className="h-11 bg-background border-muted/30 focus:border-primary focus:ring-primary/10 transition-all rounded-xl font-bold text-sm px-4 shadow-sm" 
                  />
                </div>
                
                {/* Số chứng từ - Ngắn hơn */}
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center gap-2 ml-1">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Số hiệu</Label>
                  </div>
                  <div className="relative group">
                    <Input 
                      value={form.voucherNo} 
                      onChange={e => setForm({ ...form, voucherNo: e.target.value })} 
                      className="h-11 bg-background border-muted/30 group-focus-within:border-primary transition-all rounded-xl font-mono font-bold pl-4 text-base shadow-sm" 
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={async () => setForm({ ...form, voucherNo: await getNextVoucherNo(type) || '' })} 
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 text-primary hover:bg-primary/10 rounded-lg"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* TK Nợ/Có - Dài hơn và thiết kế lại thẩm mỹ */}
                <div className="md:col-span-6 space-y-2">
                  <div className="flex items-center gap-2 ml-1">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Hạch toán kế toán</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-4 bg-background border border-muted/30 rounded-xl p-1.5 shadow-sm h-11 items-center">
                    <div className="flex items-center gap-3 px-3 border-r border-muted/20 h-full">
                      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase w-5">Nợ</span>
                      {isThu ? (
                        <div className="flex-1 font-mono font-bold text-base text-primary/80 text-center tracking-wider">111</div>
                      ) : (
                        <AccountCodeInput 
                          value={form.accountCode} 
                          onChange={code => setForm({ ...form, accountCode: code })} 
                          className="h-8 w-full bg-muted/20 border-0 rounded-lg font-mono font-bold text-base text-center text-primary p-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary/20" 
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-3 px-3 h-full">
                      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase w-5">Có</span>
                      {isThu ? (
                        <AccountCodeInput 
                          value={form.accountCode} 
                          onChange={code => setForm({ ...form, accountCode: code })} 
                          className="h-8 w-full bg-muted/20 border-0 rounded-lg font-mono font-bold text-base text-center text-primary p-0 shadow-none focus-visible:ring-2 focus-visible:ring-primary/20" 
                        />
                      ) : (
                        <div className="flex-1 font-mono font-bold text-base text-primary/80 text-center tracking-wider">111</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hàng 2: Người nộp/nhận tiền */}
              <div className="space-y-2 relative">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Đối tượng giao dịch ({isThu ? 'Người nộp' : 'Người nhận'})</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    value={form.personName} 
                    onChange={e => handleStaffSearch(e.target.value)} 
                    placeholder="Nhập họ tên hoặc chọn từ danh sách..." 
                    className="h-12 pl-11 bg-background border-muted/30 focus:border-primary transition-all rounded-xl font-bold text-sm shadow-sm"
                  />
                </div>
                {showStaffSuggestions && filteredStaff.length > 0 && (
                  <div ref={suggestionRef} className="absolute z-50 w-full mt-2 bg-card border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {filteredStaff.map((s, i) => (
                      <button key={i} type="button" onClick={() => selectStaff(s)} className="w-full flex items-center justify-between p-4 hover:bg-primary/[0.03] text-left transition-colors border-b last:border-0 group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-primary font-bold text-xs uppercase group-hover:bg-primary/10 transition-colors">
                            {(s.fullName || '?').substring(0, 1)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{s.fullName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">{s.department || 'Không rõ đơn vị'}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Grid 2 cột cho Đơn vị và Số tiền */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Đơn vị / Bộ phận</Label>
                  <DepartmentCombobox value={form.department} onChange={(val) => setForm({ ...form, department: val })} options={settings.unionGroups.map(g => g.name)} />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Số tiền giao dịch (VNĐ)</Label>
                  <div className="relative group">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
                    <Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" className="h-12 pl-11 bg-background border-muted/30 focus:border-emerald-500 transition-all rounded-xl font-black text-lg tabular-nums w-full shadow-sm" />
                  </div>
                  {amount > 0 && (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 mt-1">
                      <p className="text-[10px] font-bold text-emerald-700 italic flex items-center gap-2">
                        <Sparkles className="h-3 w-3" /> Bằng chữ: {numberToVietnameseWords(amount)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Hàng 5: Nội dung */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Nội dung {isThu ? 'thu' : 'chi'}</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ghi rõ lý do thu/chi..." rows={3} className="bg-background border-muted/30 focus:border-primary transition-all rounded-xl font-medium resize-none p-4 w-full shadow-sm text-sm" />
              </div>

              {!canPrepareThuChi && (
                <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center">
                  <p className="text-[11px] font-bold text-amber-800 flex items-center justify-center gap-2 uppercase tracking-wider">
                    <AlertTriangle className="h-4 w-4" /> Tài khoản của bạn không có quyền lập phiếu
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4 border-t border-muted/20 pt-8">
                <Button 
                  type="submit" 
                  disabled={!editingTx && !canPrepareThuChi} 
                  className={cn(
                    "flex-1 h-14 rounded-2xl font-black text-base shadow-xl transition-all duration-300 transform active:scale-[0.98]", 
                    editingTx 
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" 
                      : isThu 
                        ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" 
                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                  )}
                >
                  <Save className="h-5 w-5 mr-2" /> {editingTx ? 'CẬP NHẬT CHỨNG TỪ' : 'XÁC NHẬN & LƯU PHIẾU'}
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="h-14 w-14 rounded-2xl border-2 hover:bg-muted shadow-sm transition-all" 
                        onClick={handlePrint}
                      >
                        <Printer className="h-6 w-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>In chứng từ</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Cột phải: Cửa sổ kép - Danh sách gần đây */}
      <div className="w-full lg:w-96 space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold text-foreground">Phiếu gần đây</h2>
          </div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">{transactions.length}</Badge>
        </div>
        <Card className="border-2 shadow-lg h-[calc(100vh-250px)] overflow-hidden rounded-2xl flex flex-col bg-card/50 backdrop-blur-sm">
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted">
            <VoucherList type={type} onChanged={onSaved} refreshKey={refreshKey} onSelectForEdit={handleSelectForEdit} compact />
          </div>
          <div className="p-4 bg-muted/20 border-t text-center">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Hiển thị chứng từ gần đây</p>
          </div>
        </Card>
      </div>

      <div className="print-only hidden">
        <PrintVoucher type={type} data={{ date: form.date, voucherNo: form.voucherNo, amount, description: form.description, personName: form.personName, department: form.department, accountCode: form.accountCode, approver: form.approver, attachments: form.attachments }} signatures={printSignatures} />
      </div>
    </div>
  );
}

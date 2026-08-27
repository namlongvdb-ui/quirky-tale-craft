import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { numberToVietnameseWords } from '@/lib/finance-store';
import { Transaction } from '@/types/finance';
import { Badge } from '@/components/ui/badge';
import { Heart, Printer, Save, X, DollarSign, User, Users, AlertTriangle, Sparkles, ChevronRight, History, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PrintVisitVoucher } from './PrintVisitVoucher';
import { TransactionList } from './TransactionList';
import { useAuth } from '@/hooks/useAuth';
import { submitVoucherForSigningWithNotify } from '@/lib/signing-flow';
import { getAreaRepsByArea } from '@/lib/notification-utils';
import { useOrgSettings, useTransactions } from '@/hooks/useFinanceData';
import { useStaffList } from '@/hooks/useStaffData';
import { VoucherAttachments } from './VoucherAttachments';
import { findStaffInText, isSimilarReason, cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
        className="h-12 bg-muted/20 border-2 focus:border-primary transition-all rounded-xl"
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

interface VisitVoucherFormProps {
  onSaved?: () => void;
  refreshKey?: number;
}

export function VisitVoucherForm({ onSaved, refreshKey }: VisitVoucherFormProps) {
  const { user, profile } = useAuth();
  const { settings } = useOrgSettings();
  const { addTransaction, updateTransaction, getNextVoucherNo, transactions } = useTransactions(undefined, 'tham-hoi', refreshKey);
  const { list: staffList } = useStaffList();

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    voucherNo: '',
    visitorDepartment: '',
    recipientName: '',
    reason: '',
    amount: '200000',
    unionGroupName: '',
  });
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ message: string; severity: 'warning' | 'error' | 'info' } | null>(null);
  const [showStaffSuggestions, setShowStaffSuggestions] = useState(false);
  const [filteredStaff, setFilteredStaff] = useState<any[]>([]);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const amount = parseInt(form.amount) || 0;

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
    setForm({ ...form, recipientName: val });
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
      recipientName: staff.fullName,
      unionGroupName: staff.department || form.unionGroupName 
    });
    setShowStaffSuggestions(false);
  };

  // Kiểm tra trùng lặp
  useEffect(() => {
    if (!form.recipientName.trim() || !form.reason.trim() || staffList.length === 0) {
      setDuplicateWarning(null);
      return;
    }

    const staffName = findStaffInText(form.recipientName, staffList.map(s => s.fullName));
    if (!staffName) {
      setDuplicateWarning(null);
      return;
    }

    const currentYear = new Date(form.date).getFullYear();
    
    const staffHistory = transactions.filter(t => {
      if (editingTx && t.id === editingTx.id) return false;
      const tYear = new Date(t.date).getFullYear();
      if (tYear !== currentYear) return false;
      const content = `${t.personName} ${t.description} ${t.reason || ''} ${t.recipientName || ''}`;
      return content.toLowerCase().includes(staffName.toLowerCase());
    });

    const sameReasonHistory = staffHistory.filter(t => isSimilarReason(form.reason, t.reason || t.description));

    if (sameReasonHistory.length >= 2) {
      const latest = sameReasonHistory[0];
      setDuplicateWarning({
        severity: 'error',
        message: `Đoàn viên ${staffName} đã được chi ${sameReasonHistory.length} lần trong năm ${currentYear} cho cùng lý do này. (Lần gần nhất: Phiếu ${latest.voucherNo}, Ngày ${new Date(latest.date).toLocaleDateString('vi-VN')})`
      });
    } else if (sameReasonHistory.length === 1) {
      const latest = sameReasonHistory[0];
      setDuplicateWarning({
        severity: 'warning',
        message: `Đoàn viên ${staffName} đã có 01 phiếu chi cho lý do này trong năm ${currentYear}. (Phiếu cũ: ${latest.voucherNo}, Ngày ${new Date(latest.date).toLocaleDateString('vi-VN')})`
      });
    } else if (staffHistory.length >= 2) {
      setDuplicateWarning({
        severity: 'info',
        message: `Lưu ý: Đoàn viên ${staffName} đã có tổng cộng ${staffHistory.length} phiếu chi khác nhau trong năm ${currentYear}.`
      });
    } else {
      setDuplicateWarning(null);
    }
  }, [form.recipientName, form.reason, form.date, transactions, staffList, editingTx]);


  useEffect(() => {
    getNextVoucherNo('tham-hoi').then(no => {
      if (no) setForm(f => ({ ...f, voucherNo: no }));
    });
  }, [getNextVoucherNo]);

  useEffect(() => {
    if (settings.unionGroups.length > 0) {
      setForm(f => ({
        ...f,
        visitorDepartment: f.visitorDepartment || settings.unionGroups[0]?.name || '',
        unionGroupName: f.unionGroupName || settings.unionGroups[0]?.name || '',
      }));
    }
  }, [settings]);

  const handleSelectForEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setForm({
      date: tx.date, voucherNo: tx.voucherNo,
      visitorDepartment: tx.department || '',
      recipientName: tx.recipientName || tx.personName || '',
      reason: tx.reason || tx.description || '',
      amount: tx.amount.toString(),
      unionGroupName: tx.department || settings.unionGroups[0]?.name || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = async () => {
    setEditingTx(null);
    const no = await getNextVoucherNo('tham-hoi');
    setForm({
      date: new Date().toISOString().split('T')[0], voucherNo: no || '',
      visitorDepartment: settings.unionGroups[0]?.name || '',
      recipientName: '', reason: '', amount: '200000',
      unionGroupName: settings.unionGroups[0]?.name || '',
    });
  };

  const validateForm = () => {
    if (!form.recipientName || !form.reason || amount <= 0) {
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
          date: form.date, voucherNo: form.voucherNo, type: 'tham-hoi', amount,
          description: form.reason, personName: form.recipientName,
          department: form.unionGroupName, recipientName: form.recipientName, reason: form.reason,
        });
        toast.success(`Phiếu thăm hỏi ${form.voucherNo} đã được cập nhật`);
        return { success: true, savedTx: { ...editingTx, ...form, amount, type: 'tham-hoi' as const } as Transaction };
      } else {
        const repsForArea = await getAreaRepsByArea(form.unionGroupName || '');
        const thamHoiSigningMode = repsForArea.length > 0 ? 'area_rep' : 'leader_only';

        const txData = {
          date: form.date, voucherNo: form.voucherNo, type: 'tham-hoi' as const, amount,
          description: form.reason, personName: form.recipientName,
          department: form.unionGroupName, accountCode: '',
          approver: settings.unionGroups[0]?.leaderName || '', attachments: 0,
          recipientName: form.recipientName, reason: form.reason, createdBy: user?.id,
        };

        const voucherDataForSigning = { ...txData, thamHoiSigningMode, unionGroupName: form.unionGroupName };

        const created = await addTransaction(txData as any);
        if (user) {
          await submitVoucherForSigningWithNotify({
            voucherId: form.voucherNo,
            voucherType: 'tham-hoi',
            voucherData: voucherDataForSigning as any,
            createdBy: user.id,
            creatorName: profile?.full_name || 'Người lập',
            areaName: form.unionGroupName,
          });
        }
        toast.success(`Phiếu thăm hỏi ${form.voucherNo} đã được lưu và gửi duyệt`);
        return { success: true, savedTx: created as Transaction };
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi lưu phiếu');
      return { success: false };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { success } = await performSave();
    if (success) {
      await handleCancelEdit();
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
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cột trái: Form nhập liệu */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-sm border border-rose-100 transition-all duration-300">
              <Heart className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight leading-tight uppercase">Phiếu Thăm Hỏi</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest px-2 py-0 border-2 text-rose-600 border-rose-100 bg-rose-50/30">
                  Chế độ phúc lợi
                </Badge>
                <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-tighter opacity-60">Thăm hỏi đoàn viên</span>
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
              {/* Hàng 1: Ngày chứng từ & Số phiếu */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/5 border border-muted/20 rounded-2xl p-5 shadow-inner">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Ngày lập phiếu</Label>
                  <Input 
                    type="date" 
                    value={form.date} 
                    onChange={e => setForm({ ...form, date: e.target.value })} 
                    className="h-11 bg-background border-muted/30 focus:border-rose-500 focus:ring-rose-500/10 transition-all rounded-xl font-bold text-sm px-4 shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Số hiệu chứng từ</Label>
                  <div className="relative group">
                    <Input 
                      value={form.voucherNo} 
                      onChange={e => setForm({ ...form, voucherNo: e.target.value })} 
                      placeholder="TH..." 
                      className="h-11 bg-background border-muted/30 focus:border-rose-500 focus:ring-rose-500/10 transition-all rounded-xl font-mono font-bold pl-4 text-base shadow-sm"
                    />
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="icon" 
                      onClick={async () => setForm({ ...form, voucherNo: await getNextVoucherNo('tham-hoi') || '' })}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-rose-50 text-rose-600 rounded-lg"
                      title="Lấy số tự động"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Hàng 2: Người thăm hỏi */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Đơn vị thăm hỏi</Label>
                <DepartmentCombobox 
                  value={form.visitorDepartment} 
                  onChange={(val) => setForm({ ...form, visitorDepartment: val })} 
                  options={settings.unionGroups.map(g => g.name)} 
                />
              </div>

              {/* Hàng 3: Người được thăm hỏi */}
              <div className="space-y-2 relative">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Đối tượng được thăm hỏi (Đoàn viên)</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-rose-600 transition-colors" />
                  <Input 
                    value={form.recipientName} 
                    onChange={e => handleStaffSearch(e.target.value)} 
                    placeholder="Nhập họ tên đoàn viên được thăm hỏi..." 
                    className="h-12 pl-11 bg-background border-muted/30 focus:border-rose-500 focus:ring-rose-500/10 transition-all rounded-xl font-bold text-sm shadow-sm"
                  />
                </div>
                
                {/* Suggestions Dropdown */}
                {showStaffSuggestions && filteredStaff.length > 0 && (
                  <div ref={suggestionRef} className="absolute z-50 w-full mt-2 bg-card border shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {filteredStaff.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectStaff(s)}
                        className="w-full flex items-center justify-between p-4 hover:bg-rose-50/30 text-left transition-colors border-b last:border-0 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-xs uppercase group-hover:bg-rose-100 transition-colors">
                            {s.fullName.substring(0, 1)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground">{s.fullName}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-medium">{s.department || '—'}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hàng 5: Lý do thăm hỏi */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Lý do thăm hỏi chi tiết</Label>
                <Textarea 
                  value={form.reason} 
                  onChange={e => setForm({ ...form, reason: e.target.value })} 
                  placeholder="Ghi rõ nội dung (VD: Thăm hỏi đoàn viên ốm nằm viện điều trị tại BV...)" 
                  rows={3}
                  className="bg-background border-muted/30 focus:border-rose-500 focus:ring-rose-500/10 transition-all rounded-xl font-medium resize-none p-4 w-full shadow-sm text-sm"
                />
              </div>

              {/* Cảnh báo trùng lặp */}
              {duplicateWarning && (
                <Alert 
                  variant={duplicateWarning.severity === 'error' ? 'destructive' : 'default'} 
                  className={cn(
                    "py-4 border-2 animate-in slide-in-from-right-2 duration-300 rounded-2xl",
                    duplicateWarning.severity === 'warning' && "bg-amber-50 border-amber-200 text-amber-900",
                    duplicateWarning.severity === 'info' && "bg-blue-50 border-blue-200 text-blue-900"
                  )}
                >
                  <AlertTriangle className={cn(
                    "h-4 w-4",
                    duplicateWarning.severity === 'warning' && "text-amber-600",
                    duplicateWarning.severity === 'info' && "text-blue-600",
                    duplicateWarning.severity === 'error' && "text-destructive"
                  )} />
                  <AlertTitle className="text-[10px] font-black uppercase tracking-widest mb-1.5">
                    {duplicateWarning.severity === 'error' ? 'CẢNH BÁO CHI VƯỢT MỨC' : 
                      duplicateWarning.severity === 'warning' ? 'Cảnh báo trùng lặp' : 
                      'Thông tin đối soát'}
                  </AlertTitle>
                  <AlertDescription className="text-[11px] leading-relaxed font-medium">
                    {duplicateWarning.message}
                  </AlertDescription>
                </Alert>
              )}

              {/* Hàng 6: Số tiền chi */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Số tiền chi (VNĐ)</Label>
                <div className="relative group">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-emerald-600 transition-colors" />
                  <Input 
                    type="number" 
                    value={form.amount} 
                    onChange={e => setForm({ ...form, amount: e.target.value })} 
                    placeholder="0" 
                    className="h-12 pl-11 bg-background border-muted/30 focus:border-emerald-500 focus:ring-emerald-500/10 transition-all rounded-xl font-black text-lg tabular-nums w-full shadow-sm"
                  />
                </div>
                {amount > 0 && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-2 mt-1">
                    <p className="text-[10px] font-bold text-emerald-700 italic flex items-center gap-2">
                      <Sparkles className="h-3 w-3" /> Bằng chữ: {numberToVietnameseWords(amount)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 border-t border-muted/20 pt-8">
                <Button 
                  type="submit"
                  className="flex-1 h-14 rounded-2xl bg-rose-600 text-white font-black text-base shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all duration-300 transform active:scale-[0.98]"
                >
                  <Save className="h-5 w-5 mr-2" />
                  {editingTx ? 'CẬP NHẬT CHỨNG TỪ' : 'XÁC NHẬN & LƯU PHIẾU'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="h-14 w-14 rounded-2xl border-2 hover:bg-muted shadow-sm transition-all" 
                  onClick={handlePrint}
                  title="In phiếu thăm hỏi"
                >
                  <Printer className="h-6 w-6" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* File scan attachments */}
        <div className="no-print">
          <VoucherAttachments
            voucherId={form.voucherNo}
            voucherType="tham-hoi"
          />
        </div>

        {/* Nội dung in ấn */}
        <div className="print-only hidden">
          <PrintVisitVoucher data={{ ...form, amount: Number(form.amount) || 0 }} />
        </div>
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
        <Card className="border-border shadow-xl overflow-hidden rounded-3xl flex flex-col bg-card/50 backdrop-blur-sm h-[calc(100vh-250px)] border-2">
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted p-2">
            <TransactionList 
              type="tham-hoi"
              title="PHIẾU THĂM HỎI"
              personLabel="Người được thăm hỏi"
              onChanged={onSaved}
              refreshKey={refreshKey}
              onSelectForEdit={handleSelectForEdit}
            />
          </div>
          <div className="p-4 bg-muted/5 border-t border-border/50 text-center">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">Hiển thị dữ liệu mới nhất</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

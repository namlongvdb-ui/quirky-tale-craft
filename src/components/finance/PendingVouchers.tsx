import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { pendingVouchersApi, profilesApi } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { getVoucherLabel, getSigningStep } from '@/lib/notification-utils';
import { signVoucherWith3StepNotify } from '@/lib/signing-flow';
import { toast } from 'sonner';
import { PenTool, CheckCircle2, ClipboardList, Loader2, CalendarIcon, X } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

function normalizeForMatch(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

interface PendingVoucher {
  id: string;
  voucher_id: string;
  voucher_type: string;
  voucher_data: any;
  created_by: string;
  status: string;
  created_at: string;
  creator_name?: string;
  signing_step?: string;
}

export function PendingVouchers() {
  const { user, profile, hasRole } = useAuth();
  const [vouchers, setVouchers] = useState<PendingVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<PendingVoucher | null>(null);
  const [password, setPassword] = useState('');
  const [signing, setSigning] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const isLeader = hasRole('lanh_dao');
  const isAccountant = hasRole('ke_toan');
  const isAreaRep = hasRole('phu_trach_dia_ban');
  const isSignerRole = isLeader || isAccountant || isAreaRep;

  const fetchPending = useCallback(async () => {
    setLoading(true);
    if (!user) { setLoading(false); return; }

    const { data: allPending } = await pendingVouchersApi.getAll();
    const pendingData = (allPending || []).filter((v: any) => ['pending', 'partially_signed'].includes(v.status));

    if (!pendingData) { setLoading(false); return; }

    // Get current user's assigned area for area-based filtering
    const userAssignedArea = profile?.assigned_area || null;

    const filteredVouchers: PendingVoucher[] = [];

    for (const v of pendingData) {
      const step = await getSigningStep(v.voucher_id, v.voucher_type, v.voucher_data);

      if (step === 'fully_signed') continue;

      if (step === 'pending') {
        // Bước 1: 
        // - tham-hoi: phụ trách địa bàn hoặc lãnh đạo (nếu không địa bàn)
        // - thu/chi: lãnh đạo ký duy nhất (không còn bước kế toán)
        // - de-nghi: kế toán ký trước
        if (v.voucher_type === 'thu' || v.voucher_type === 'chi') {
          if (!isLeader) continue;
        } else if (v.voucher_type === 'tham-hoi') {
          const mode = (v.voucher_data as any)?.thamHoiSigningMode;
          if (mode === 'leader_only') {
            if (!isLeader) continue;
          } else {
            if (!isAreaRep) continue;
            const voucherUnionGroup = (v.voucher_data as any)?.department || (v.voucher_data as any)?.unionGroupName || '';
            if (userAssignedArea && voucherUnionGroup) {
              const userAreas = userAssignedArea.split(',').map(a => a.trim());
              const gnorm = normalizeForMatch(voucherUnionGroup);
              const matched = userAreas.some(area => {
                const an = normalizeForMatch(area);
                return an && gnorm && (gnorm.includes(an) || an.includes(gnorm));
              });
              if (!matched) continue;
            }
          }
        } else {
          if (!isAccountant) continue;
        }
      } else if (step === 'first_signed') {
        // Bước 2: chờ lãnh đạo ký
        if (!isLeader) continue; // chỉ lãnh đạo thấy
      }

      filteredVouchers.push({ ...v, voucher_data: v.voucher_data as any, signing_step: step });
    }

    // Get creator names
    const creatorIds = [...new Set(filteredVouchers.map(v => v.created_by))];
    if (creatorIds.length > 0) {
      const { data: profiles } = await profilesApi.getAll();

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      filteredVouchers.forEach(v => {
        v.creator_name = profileMap.get(v.created_by) || 'N/A';
      });
    }

    setVouchers(filteredVouchers);
    setLoading(false);
  }, [user, profile?.assigned_area, isLeader, isAccountant, isAreaRep]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const filteredVouchers = useMemo(() => {
    if (!dateFrom && !dateTo) return vouchers;
    return vouchers.filter(v => {
      const vDate = new Date(v.voucher_data?.date || v.created_at);
      if (dateFrom && dateTo) {
        return isWithinInterval(vDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
      }
      if (dateFrom) return vDate >= startOfDay(dateFrom);
      if (dateTo) return vDate <= endOfDay(dateTo);
      return true;
    });
  }, [vouchers, dateFrom, dateTo]);

  const handleSign = async () => {
    if (!selectedVoucher || !user || !password) return;
    setSigning(true);

    try {
      const signerName = profile?.full_name || 'Người ký';
      const stepBeforeSign = selectedVoucher.signing_step;
      // Use shared signing flow to guarantee the 3-step notification chain
      const res = await signVoucherWith3StepNotify({
        voucherId: selectedVoucher.voucher_id,
        voucherType: selectedVoucher.voucher_type as any,
        voucherData: selectedVoucher.voucher_data,
        signerId: user.id,
        signerName,
        signPassword: password,
        stepBeforeSign: stepBeforeSign as any,
        pendingVoucherId: selectedVoucher.id,
        creatorId: selectedVoucher.created_by,
      });

      if (!res.ok) {
        // Shared flow already shows proper toast; keep state clean.
        setSigning(false);
        return;
      }

      setSignDialogOpen(false);
      setPassword('');
      setSelectedVoucher(null);
      fetchPending();
    } catch {
      // Shared flow already toasts; avoid duplicates.
    }
    setSigning(false);
  };

  const roleLabel = isLeader ? '(Lãnh đạo)' : isAccountant ? '(Kế toán)' : isAreaRep ? '(Phụ trách địa bàn)' : '';

  return (
    <Card className="shadow-lg border-0 ring-1 ring-border">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-b-2 border-amber-200 dark:border-amber-800">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-xl">Chứng từ chờ ký duyệt {roleLabel}</CardTitle>
              {filteredVouchers.length !== vouchers.length && (
                <p className="text-xs text-muted-foreground mt-0.5">{filteredVouchers.length}/{vouchers.length} kết quả</p>
              )}
            </div>
          </div>
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
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-green-400" />
            <p>{dateFrom || dateTo ? 'Không có chứng từ trong khoảng thời gian này' : 'Không có chứng từ nào cần ký'}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loại</TableHead>
                <TableHead>Số chứng từ</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Nội dung</TableHead>
                <TableHead className="text-right">Số tiền</TableHead>
                <TableHead>Người tạo</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-center">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVouchers.map(v => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Badge variant="outline">{getVoucherLabel(v.voucher_type)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{v.voucher_id}</TableCell>
                  <TableCell>{v.voucher_data?.date || format(new Date(v.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="max-w-48 truncate">{v.voucher_data?.description || ''}</TableCell>
                  <TableCell className="text-right font-medium">
                    {(v.voucher_data?.amount || 0).toLocaleString('vi-VN')}đ
                  </TableCell>
                  <TableCell>{v.creator_name}</TableCell>
                  <TableCell>
                    <Badge variant={v.signing_step === 'first_signed' ? 'default' : 'secondary'} className="text-xs">
                      {v.signing_step === 'first_signed' ? 'Chờ lãnh đạo ký' : 'Chờ duyệt'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => { setSelectedVoucher(v); setSignDialogOpen(true); }}
                    >
                      <PenTool className="h-4 w-4 mr-1" /> Ký
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ký duyệt chứng từ</DialogTitle>
            <DialogDescription>
              {selectedVoucher && `${getVoucherLabel(selectedVoucher.voucher_type)} số ${selectedVoucher.voucher_id}`}
            </DialogDescription>
          </DialogHeader>
          {selectedVoucher && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><span className="font-medium">Ngày:</span> {selectedVoucher.voucher_data?.date}</p>
                <p><span className="font-medium">Nội dung:</span> {selectedVoucher.voucher_data?.description}</p>
                <p><span className="font-medium">Số tiền:</span> {(selectedVoucher.voucher_data?.amount || 0).toLocaleString('vi-VN')}đ</p>
                <p><span className="font-medium">Người liên quan:</span> {selectedVoucher.voucher_data?.personName}</p>
              </div>
              <div className="space-y-2">
                <Label>Nhập mật khẩu để ký</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mật khẩu chữ ký số..."
                  onKeyDown={e => e.key === 'Enter' && handleSign()}
                />
              </div>
              <Button onClick={handleSign} disabled={signing || !password} className="w-full">
                {signing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PenTool className="h-4 w-4 mr-2" />}
                Xác nhận ký duyệt
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

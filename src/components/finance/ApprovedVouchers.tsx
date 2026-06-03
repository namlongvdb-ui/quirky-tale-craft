import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getVoucherLabel } from '@/lib/notification-utils';
import { toast } from 'sonner';
import { Printer, CheckCircle2, FileCheck, Loader2, CalendarIcon, X } from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { PrintVoucher } from './PrintVoucher';
import { PrintVisitVoucher } from './PrintVisitVoucher';
import { PrintPaymentRequest } from './PrintPaymentRequest';

interface ApprovedVoucher {
  id: string;
  voucher_id: string;
  voucher_type: string;
  voucher_data: any;
  created_by: string;
  status: string;
  created_at: string;
  signed_at: string | null;
  printed_at: string | null;
}

interface SignatureDisplay {
  signer_name: string;
  role: string;
  signed_at: string;
}

export function ApprovedVouchers() {
  const { user } = useAuth();
  const [vouchers, setVouchers] = useState<ApprovedVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [printingVoucher, setPrintingVoucher] = useState<ApprovedVoucher | null>(null);
  const [printSignatures, setPrintSignatures] = useState<SignatureDisplay[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchApproved = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data } = await supabase
      .from('pending_vouchers')
      .select('*')
      .in('status', ['signed', 'printed'])
      .order('signed_at', { ascending: false });

    setVouchers((data || []).map(v => ({ ...v, voucher_data: v.voucher_data as any })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchApproved(); }, [fetchApproved]);

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

  const fetchSignatures = async (voucherId: string, voucherType: string): Promise<SignatureDisplay[]> => {
    const { data: sigs } = await supabase
      .from('voucher_signatures')
      .select('signer_id, signed_at')
      .eq('voucher_id', voucherId)
      .eq('voucher_type', voucherType);

    if (!sigs || sigs.length === 0) return [];

    const { fetchDirectoryProfiles, fetchDirectoryUserRoles } = await import('@/lib/directory');
    const [profiles, roles] = await Promise.all([
      fetchDirectoryProfiles(),
      fetchDirectoryUserRoles(),
    ]);

    return sigs.map(s => {
      const profile = profiles.find(p => p.user_id === s.signer_id);
      const role = roles.find(r => r.user_id === s.signer_id);
      return {
        signer_name: profile?.full_name || 'Unknown',
        role: role?.role || '',
        signed_at: s.signed_at,
      };
    });
  };

  const handlePrint = async (voucher: ApprovedVoucher) => {
    const sigs = await fetchSignatures(voucher.voucher_id, voucher.voucher_type);
    setPrintSignatures(sigs);
    setPrintingVoucher(voucher);

    setTimeout(() => {
      window.print();
      supabase.from('pending_vouchers')
        .update({ status: 'printed', printed_at: new Date().toISOString() })
        .eq('id', voucher.id)
        .then(() => { fetchApproved(); });
    }, 300);
  };

  const renderPrintContent = () => {
    if (!printingVoucher) return null;
    const v = printingVoucher;
    const data = v.voucher_data;

    if (v.voucher_type === 'thu' || v.voucher_type === 'chi') {
      return (
        <PrintVoucher
          type={v.voucher_type as 'thu' | 'chi'}
          data={{
            date: data.date || '',
            voucherNo: v.voucher_id,
            amount: data.amount || 0,
            description: data.description || '',
            personName: data.personName || '',
            department: data.department || '',
            accountCode: data.accountCode || '',
            approver: data.approver || '',
            attachments: data.attachments || 0,
          }}
          signatures={printSignatures}
        />
      );
    }

    if (v.voucher_type === 'tham-hoi') {
      return (
        <PrintVisitVoucher
          data={{
            date: data.date || '',
            visitorDepartment: data.department || '',
            recipientName: data.recipientName || data.personName || '',
            reason: data.reason || data.description || '',
            amount: data.amount || 0,
            unionGroupName: data.department || '',
          }}
        />
      );
    }

    if (v.voucher_type === 'de-nghi') {
      return (
        <PrintPaymentRequest
          data={{
            date: data.date || '',
            requestNo: '',
            requesterName: data.personName || '',
            department: data.department || '',
            content: data.description || '',
            amount: data.amount || 0,
            times: data.times || '',
            bankAccount: data.bankAccount || '',
            bankAccountName: data.bankAccountName || '',
            bankName: data.bankName || '',
            attachments: data.attachments?.toString() || '',
          }}
        />
      );
    }

    return null;
  };

  return (
    <>
      <Card className="shadow-lg border-0 ring-1 ring-border">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-b-2 border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardTitle className="text-xl">Chứng từ đã duyệt</CardTitle>
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
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-muted-foreground/50" />
              <p>{dateFrom || dateTo ? 'Không có chứng từ trong khoảng thời gian này' : 'Chưa có chứng từ nào được duyệt'}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Số chứng từ</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead>Ngày ký</TableHead>
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
                    <TableCell>
                      {v.signed_at ? format(new Date(v.signed_at), 'dd/MM/yyyy HH:mm') : '—'}
                    </TableCell>
                    <TableCell>
                      {v.status === 'printed' ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Đã in</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">Đã ký</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrint(v)}
                      >
                        <Printer className="h-4 w-4 mr-1" /> In chứng từ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Hidden print content */}
      <div ref={printRef} className="print-only hidden">
        {renderPrintContent()}
      </div>
    </>
  );
}
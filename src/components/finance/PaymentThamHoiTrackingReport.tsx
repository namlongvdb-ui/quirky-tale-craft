import { useMemo, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrgSettings, useTransactions } from '@/hooks/useFinanceData';
import { useStaffList } from '@/hooks/useStaffData';
import { FileText, Heart, Link2, Loader2, AlertCircle, CheckCircle2, Search, ArrowRight, ExternalLink, AlertTriangle, UserMinus, Printer } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn, findStaffInText, isSimilarReason } from '@/lib/utils';
import { toast } from 'sonner';
import { PrintTrackingReport } from './PrintTrackingReport';
import { printElementRef } from '@/lib/print-html';

interface PaymentThamHoiTrackingReportProps {
  refreshKey?: number;
}

export function PaymentThamHoiTrackingReport({ refreshKey }: PaymentThamHoiTrackingReportProps) {
  const { transactions: deNghiRows, loading: loadingDn } = useTransactions(undefined, 'de-nghi', refreshKey);
  const { transactions: thamHoiRows, loading: loadingTh } = useTransactions(undefined, 'tham-hoi', refreshKey);
  const { list: staffList } = useStaffList();
  const [search, setSearch] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const loading = loadingDn || loadingTh;

  const handlePrint = () => {
    if (!printElementRef(printRef, 'Báo cáo theo dõi thăm hỏi đoàn viên', { landscape: true })) {
      toast.error('Không lấy được nội dung để in');
    }
  };

  const thMap = useMemo(() => {
    const m = new Map<string, (typeof thamHoiRows)[0]>();
    for (const t of thamHoiRows) {
      const no = (t.voucherNo || '').trim();
      if (!no) continue;
      m.set(no.toLowerCase(), t);
    }
    return m;
  }, [thamHoiRows]);

  // Danh sách đã khớp
  const linkedRows = useMemo(() => {
    return deNghiRows
      .filter(d => !!d.linkedThamHoiVoucherNo?.trim())
      .map(d => {
        const key = (d.linkedThamHoiVoucherNo || '').trim().toLowerCase();
        const th = thMap.get(key);
        return { dn: d, th };
      })
      .sort((a, b) => b.dn.date.localeCompare(a.dn.date));
  }, [deNghiRows, thMap]);

  // Danh sách Đề nghị chưa có liên kết
  const unlinkedDn = useMemo(() => {
    return deNghiRows.filter(d => !d.linkedThamHoiVoucherNo?.trim());
  }, [deNghiRows]);

  // Danh sách Thăm hỏi chưa được Đề nghị nào trỏ tới
  const unlinkedTh = useMemo(() => {
    const linkedThNos = new Set(deNghiRows.map(d => d.linkedThamHoiVoucherNo?.trim().toLowerCase()).filter(Boolean));
    return thamHoiRows.filter(t => !linkedThNos.has(t.voucherNo.toLowerCase()));
  }, [thamHoiRows, deNghiRows]);

  // Logic phát hiện chi vượt mức (Bổ sung mới)
  const overPaymentAlerts = useMemo(() => {
    if (staffList.length === 0) return [];
    
    const staffNames = staffList.map(s => s.fullName);
    const allRelevantTxs = [...deNghiRows, ...thamHoiRows];
    const alerts: { staffName: string; reason: string; count: number; items: any[] }[] = [];

    // Gom nhóm theo đoàn viên
    const staffGroups = new Map<string, any[]>();
    for (const tx of allRelevantTxs) {
      // CHỈ quét tên đoàn viên ở phần Người được thăm hỏi và Nội dung/Lý do
      // Loại bỏ tx.personName (người đề nghị) để tránh cảnh báo sai cho tổ trưởng/người lập phiếu
      const content = `${tx.recipientName || ''} ${tx.description} ${tx.reason || ''}`;
      const foundStaff = findStaffInText(content, staffNames);
      if (foundStaff) {
        if (!staffGroups.has(foundStaff)) staffGroups.set(foundStaff, []);
        staffGroups.get(foundStaff)?.push(tx);
      }
    }

    // Trong mỗi đoàn viên, gom nhóm theo lý do
    staffGroups.forEach((txs, staffName) => {
      const reasonGroups: any[][] = [];
      
      for (const tx of txs) {
        let foundGroup = false;
        const currentReason = tx.reason || tx.description;
        
        for (const group of reasonGroups) {
          if (isSimilarReason(currentReason, group[0].reason || group[0].description)) {
            group.push(tx);
            foundGroup = true;
            break;
          }
        }
        
        if (!foundGroup) {
          reasonGroups.push([tx]);
        }
      }

      // Kiểm tra xem nhóm lý do nào có > 2 sự kiện (mỗi sự kiện là 1 cặp DN-TH hoặc 1 phiếu lẻ)
      for (const group of reasonGroups) {
        // Đếm "sự kiện thực tế": Nếu có cặp DN-TH liên kết nhau thì chỉ tính là 1
        const linkedThNos = new Set(group.filter(t => t.type === 'de-nghi' && t.linkedThamHoiVoucherNo).map(t => t.linkedThamHoiVoucherNo.toLowerCase()));
        
        const uniqueEvents = group.filter(t => {
          if (t.type === 'tham-hoi' && linkedThNos.has(t.voucherNo.toLowerCase())) return false;
          return true;
        });

        if (uniqueEvents.length >= 2) {
          alerts.push({
            staffName,
            reason: group[0].reason || group[0].description,
            count: uniqueEvents.length,
            items: uniqueEvents.sort((a, b) => b.date.localeCompare(a.date))
          });
        }
      }
    });

    return alerts.sort((a, b) => b.count - a.count);
  }, [deNghiRows, thamHoiRows, staffList]);

  const filteredLinked = useMemo(() => {
    if (!search.trim()) return linkedRows;
    const q = search.toLowerCase();
    return linkedRows.filter(r => 
      r.dn.voucherNo.toLowerCase().includes(q) || 
      r.dn.personName.toLowerCase().includes(q) ||
      (r.th && r.th.voucherNo.toLowerCase().includes(q))
    );
  }, [linkedRows, search]);

  const stats = useMemo(() => {
    const sumLinked = linkedRows.reduce((s, r) => s + r.dn.amount, 0);
    return {
      totalDeNghi: deNghiRows.length,
      linkedCount: linkedRows.length,
      sumLinked,
      unlinkedDnCount: unlinkedDn.length,
      unlinkedThCount: unlinkedTh.length,
      alertCount: overPaymentAlerts.length,
    };
  }, [deNghiRows.length, linkedRows, unlinkedDn.length, unlinkedTh.length, overPaymentAlerts.length]);


  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <Card className="border-border shadow-lg overflow-hidden border-0 ring-1 ring-border">
        <CardHeader className="bg-muted/30 border-b py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold">Theo dõi thăm hỏi đoàn viên</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Quản lý và rà soát các phiếu thăm hỏi chi cho đoàn viên</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={handlePrint} 
                variant="outline" 
                size="sm" 
                className="rounded-xl border-2 h-9 px-4 font-black text-[10px] uppercase tracking-widest hover:bg-muted transition-all shadow-sm"
              >
                <Printer className="h-3.5 w-3.5 mr-2 text-primary" /> In báo cáo
              </Button>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Tìm số phiếu, họ tên..." 
                  className="pl-9 h-9 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="all" className="w-full">
            <div className="px-6 border-b bg-muted/10">
              <TabsList className="h-12 bg-transparent gap-6 p-0">
                <TabsTrigger value="all" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1">
                  Tất cả phiếu thăm hỏi
                  <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-0">{thamHoiRows.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="alerts" className="h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1">
                  Cảnh báo chi vượt mức
                  <Badge variant="destructive" className="ml-2 border-0">{stats.alertCount}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="m-0">
              {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : thamHoiRows.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">Không tìm thấy dữ liệu phù hợp</div>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableHead className="w-[180px] font-bold text-rose-700 dark:text-rose-400">PHIẾU THĂM HỎI</TableHead>
                        <TableHead className="font-bold text-rose-700 dark:text-rose-400">Lý do / Nội dung chi tiết</TableHead>
                        <TableHead className="font-bold text-rose-700 dark:text-rose-400">Đoàn viên được TH</TableHead>
                        <TableHead className="font-bold text-rose-700 dark:text-rose-400">Tổ công đoàn</TableHead>
                        <TableHead className="text-right font-bold text-rose-700 dark:text-rose-400">Số tiền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {thamHoiRows.filter(t => {
                        if (!search.trim()) return true;
                        const q = search.toLowerCase();
                        return t.voucherNo.toLowerCase().includes(q) || 
                               t.personName.toLowerCase().includes(q) ||
                               (t.reason || t.description).toLowerCase().includes(q);
                      }).map((th) => (
                        <TableRow key={th.id} className="group hover:bg-muted/30">
                          <TableCell>
                            <div className="flex flex-col">
                              <Badge variant="outline" className="font-mono w-fit text-rose-600 border-rose-200 bg-rose-50/50">{th.voucherNo}</Badge>
                              <span className="text-[10px] text-muted-foreground mt-1">{new Date(th.date).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium leading-tight">{th.reason || th.description}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-[10px] uppercase">
                                {(th.recipientName || th.personName || '?').substring(0, 1)}
                              </div>
                              <span className="text-sm font-bold">{th.recipientName || th.personName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">{th.department || '—'}</span>
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums text-rose-600">
                            {th.amount.toLocaleString('vi-VN')}
                            <span className="ml-0.5 text-[10px] font-medium underline decoration-rose-400/50 underline-offset-2">đ</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="alerts" className="m-0 p-6 space-y-4">
              {overPaymentAlerts.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-500" />
                  <p>Chưa phát hiện trường hợp nào chi vượt quá 2 lần/lý do cho cùng một đoàn viên.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-lg flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                    <div>
                      <h5 className="font-bold text-sm">Danh sách các trường hợp cần rà soát đặc biệt</h5>
                      <p className="text-xs opacity-90 mt-1">
                        Hệ thống phát hiện các đoàn viên dưới đây xuất hiện trong ít nhất 2 sự kiện chi (đã loại trừ các phiếu liên kết nhau) cho cùng một lý do trong năm nay.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {overPaymentAlerts.map((alert, idx) => (
                      <Card key={idx} className="border-rose-200 shadow-sm overflow-hidden border">
                        <div className="bg-rose-50 px-4 py-2 border-b border-rose-200 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <UserMinus className="h-4 w-4 text-rose-600" />
                            <span className="font-bold text-rose-800">{alert.staffName}</span>
                          </div>
                          <Badge variant="destructive" className="animate-pulse">Đã chi {alert.count} lần</Badge>
                        </div>
                        <div className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-[10px] uppercase font-bold">Ngày</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Số phiếu</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Loại</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold">Nội dung chi tiết</TableHead>
                                <TableHead className="text-[10px] uppercase font-bold text-right">Số tiền</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {alert.items.map((item, i) => (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">{new Date(item.date).toLocaleDateString('vi-VN')}</TableCell>
                                  <TableCell className="text-xs font-mono font-bold">{item.voucherNo}</TableCell>
                                  <TableCell className="text-xs">
                                    <Badge variant="outline" className={cn("text-[10px]", item.type === 'tham-hoi' ? "text-rose-600 border-rose-200" : "text-blue-600 border-blue-200")}>
                                      {item.type === 'tham-hoi' ? 'Thăm hỏi' : 'Đề nghị TT'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs">{item.description || item.reason}</TableCell>
                                  <TableCell className="text-xs text-right font-bold tabular-nums">
                                    {item.amount.toLocaleString('vi-VN')}
                                    <span className="ml-0.5 text-[10px] font-medium underline decoration-muted-foreground/30 underline-offset-2">đ</span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="bg-muted/10 p-2 px-4 border-t text-[10px] text-muted-foreground">
                          Lý do nhận diện: <span className="font-medium text-foreground italic">"{alert.reason}"</span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Hidden print area */}
      <div ref={printRef} className="print-only hidden">
        <PrintTrackingReport />
      </div>
    </div>
  );
}


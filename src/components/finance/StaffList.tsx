import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StaffMember, StaffSettings } from '@/types/finance';
import {
  getStaffList, addStaff, updateStaff, deleteStaff,
  getStaffSettings, saveStaffSettings,
  calculateInsuranceSalary, calculateUnionFee,
  getTransferHistory, addTransferRecord,
} from '@/lib/staff-store';
import { getOrgSettings } from '@/lib/finance-store';
import { TransferRecord } from '@/types/finance';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Plus, Trash2, Pencil, Save, Settings2, Printer, Receipt, ChevronsUpDown, Check, ArrowRightLeft, LogOut, History, FileSpreadsheet, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { PrintStaffList, PrintMonthlyFee } from './PrintStaffList';
import { exportStaffListExcel } from '@/lib/export-utils';

const POSITION_OPTIONS = [
  'Giám đốc', 'Phó Giám đốc', 'Trưởng phòng', 'Phó Trưởng phòng',
  'Chủ tịch', 'Phó Chủ tịch', 'Ủy viên', 'Tổ trưởng', 'Tổ phó',
  'Chuyên viên chính', 'Chuyên viên', 'Cán sự', 'Nhân viên',
];

const emptyStaff: Omit<StaffMember, 'id'> = {
  fullName: '', department: '', position: '', birthDate: '', gender: 'nam',
  salaryCoefficient: 0, positionCoefficient: 0, regionalSalary: 2340000,
};

function PositionCombobox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = POSITION_OPTIONS.filter(p => p.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {value || 'Chọn chức vụ...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Tìm hoặc nhập chức vụ..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <Button variant="ghost" className="w-full" onClick={() => { onChange(search.trim()); setOpen(false); setSearch(''); }}>
                  Dùng "{search.trim()}"
                </Button>
              ) : 'Không tìm thấy'}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map(p => (
                <CommandItem key={p} value={p} onSelect={() => { onChange(p); setOpen(false); setSearch(''); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === p ? "opacity-100" : "opacity-0")} />
                  {p}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function StaffList() {
  const [list, setList] = useState<StaffMember[]>([]);
  const [settings, setSettings] = useState<StaffSettings>(getStaffSettings());
  const [form, setForm] = useState(emptyStaff);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [printMode, setPrintMode] = useState<'staff' | 'fee' | null>(null);
  const [feeMonth, setFeeMonth] = useState(new Date().getMonth() + 1);
  const [feeYear, setFeeYear] = useState(new Date().getFullYear());
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<StaffMember | null>(null);
  const [transferDept, setTransferDept] = useState('');
  const [transferType, setTransferType] = useState<'move' | 'out'>('move');
  const [activeTab, setActiveTab] = useState('all');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [bulkTransferOpen, setBulkTransferOpen] = useState(false);
  const [bulkTransferStaff, setBulkTransferStaff] = useState<string>('');
  const [bulkTransferDept, setBulkTransferDept] = useState('');
  const [bulkTransferType, setBulkTransferType] = useState<'move' | 'out'>('move');
  const printRef = useRef<HTMLDivElement>(null);

  const orgSettings = getOrgSettings();
  const unionGroupNames = orgSettings.unionGroups.map(g => g.name);

  useEffect(() => { setList(getStaffList()); }, []);
  const reload = () => setList(getStaffList());

  const handleSaveSettings = () => {
    saveStaffSettings(settings);
    toast.success('Đã lưu thông số lương chung');
    setSettingsOpen(false);
  };

  const handleSubmit = () => {
    if (!form.fullName.trim()) { toast.error('Vui lòng nhập họ tên'); return; }
    if (!form.department.trim()) { toast.error('Vui lòng chọn tổ công đoàn'); return; }
    if (editingId) {
      updateStaff(editingId, form);
      toast.success('Đã cập nhật đoàn viên');
    } else {
      addStaff(form);
      toast.success('Đã thêm đoàn viên');
    }
    setForm(emptyStaff);
    setEditingId(null);
    setDialogOpen(false);
    reload();
  };

  const handleEdit = (s: StaffMember) => {
    setForm({ fullName: s.fullName, department: s.department, position: s.position, birthDate: s.birthDate, gender: s.gender, salaryCoefficient: s.salaryCoefficient, positionCoefficient: s.positionCoefficient, regionalSalary: s.regionalSalary });
    setEditingId(s.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteStaff(id);
    toast.success('Đã xóa đoàn viên');
    reload();
  };

  const handleOpenTransfer = (s: StaffMember, type: 'move' | 'out') => {
    setTransferTarget(s);
    setTransferType(type);
    setTransferDept(type === 'out' ? 'Đã chuyển khỏi ngành' : '');
    setTransferDialogOpen(true);
  };

  const handleTransfer = () => {
    if (!transferTarget) return;
    if (transferType === 'move' && !transferDept) {
      toast.error('Vui lòng chọn tổ công đoàn đích');
      return;
    }
    const record = {
      staffId: transferTarget.id,
      staffName: transferTarget.fullName,
      fromDepartment: transferTarget.department,
      toDepartment: transferType === 'out' ? 'Ra khỏi ngành' : transferDept,
      type: transferType,
      date: new Date().toISOString().split('T')[0],
    };
    addTransferRecord(record);

    if (transferType === 'out') {
      deleteStaff(transferTarget.id);
      toast.success(`Đã chuyển ${transferTarget.fullName} ra khỏi ngành`);
    } else {
      updateStaff(transferTarget.id, { department: transferDept });
      toast.success(`Đã chuyển ${transferTarget.fullName} sang ${transferDept}`);
    }
    setTransferDialogOpen(false);
    setTransferTarget(null);
    reload();
  };

  const openHistory = () => {
    setTransferHistory(getTransferHistory());
    setHistoryOpen(true);
  };

  const handleBulkTransfer = () => {
    if (!bulkTransferStaff) { toast.error('Vui lòng chọn đoàn viên'); return; }
    const staff = list.find(s => s.id === bulkTransferStaff);
    if (!staff) return;
    if (bulkTransferType === 'move' && !bulkTransferDept) { toast.error('Vui lòng chọn tổ đích'); return; }
    const record = {
      staffId: staff.id,
      staffName: staff.fullName,
      fromDepartment: staff.department,
      toDepartment: bulkTransferType === 'out' ? 'Ra khỏi ngành' : bulkTransferDept,
      type: bulkTransferType,
      date: new Date().toISOString().split('T')[0],
    };
    addTransferRecord(record);
    if (bulkTransferType === 'out') {
      deleteStaff(staff.id);
      toast.success(`Đã chuyển ${staff.fullName} ra khỏi ngành`);
    } else {
      updateStaff(staff.id, { department: bulkTransferDept });
      toast.success(`Đã chuyển ${staff.fullName} sang ${bulkTransferDept}`);
    }
    setBulkTransferOpen(false);
    setBulkTransferStaff('');
    setBulkTransferDept('');
    reload();
  };

  // Group by department
  const groupedByDept = useMemo(() => {
    const map: Record<string, StaffMember[]> = {};
    for (const s of list) {
      const dept = s.department || 'Chưa phân tổ';
      if (!map[dept]) map[dept] = [];
      map[dept].push(s);
    }
    return map;
  }, [list]);

  const filteredList = useMemo(() => {
    if (activeTab === 'all') return list;
    return list.filter(s => s.department === activeTab);
  }, [list, activeTab]);

  const openLandscapePrintWindow = (mode: 'staff' | 'fee') => {
    const printMarkup = printRef.current?.innerHTML;

    if (!printMarkup) {
      toast.error('Không lấy được nội dung để in');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1400,height=900');
    if (!printWindow) {
      toast.error('Trình duyệt đang chặn cửa sổ in');
      return;
    }

    const title = mode === 'fee' ? 'Danh sách thu đoàn phí' : 'Danh sách đoàn viên';

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="vi">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${title}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 12mm;
            }

            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
            }

            body {
              font-family: 'Times New Roman', Times, serif;
            }

            .print-content {
              width: 100%;
              font-family: 'Times New Roman', Times, serif;
              line-height: 1.4;
              color: #000;
            }

            .print-content table {
              width: 100%;
              border-collapse: collapse;
            }

            .print-content td,
            .print-content th {
              border: 1px solid #000;
            }
          </style>
        </head>
        <body>${printMarkup}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handlePrint = (mode: 'staff' | 'fee') => {
    setPrintMode(mode);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        openLandscapePrintWindow(mode);
      });
    });
  };

  const totalUnionFee = useMemo(() => {
    return list.reduce((sum, s) => {
      const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
      return sum + calculateUnionFee(lbh, settings.baseSalary);
    }, 0);
  }, [list, settings]);

  const fmt = (n: number) => n.toLocaleString('vi-VN');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <h2 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Users className="h-6 w-6" /> Danh sách đoàn viên
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setBulkTransferOpen(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-1" /> Điều chuyển đoàn viên
          </Button>
          <Button variant="outline" size="sm" onClick={openHistory}>
            <History className="h-4 w-4 mr-1" /> Lịch sử điều chuyển
          </Button>
          <Button variant="outline" size="sm" onClick={() => { exportStaffListExcel(); toast.success('Đã xuất file Excel'); }}>
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Xuất Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePrint('staff')}>
            <Printer className="h-4 w-4 mr-1" /> In danh sách
          </Button>

          {/* Monthly fee print dialog */}
          <Dialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Receipt className="h-4 w-4 mr-1" /> In thu đoàn phí
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs">
              <DialogHeader><DialogTitle>In danh sách thu đoàn phí</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tháng</Label>
                    <Select value={String(feeMonth)} onValueChange={v => setFeeMonth(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>Tháng {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Năm</Label>
                    <Input type="number" value={feeYear} onChange={e => setFeeYear(Number(e.target.value) || new Date().getFullYear())} />
                  </div>
                </div>
                <Button className="w-full" onClick={() => { setFeeDialogOpen(false); handlePrint('fee'); }}>
                  <Printer className="h-4 w-4 mr-1" /> In
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Settings dialog */}
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Settings2 className="h-4 w-4 mr-1" /> Thông số lương</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Thông số lương chung</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                {([
                  ['baseSalary', 'Lương cơ sở (VNĐ) - để tính trần đoàn phí'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input type="number" value={settings[key]} onChange={e => setSettings(prev => ({ ...prev, [key]: Number(e.target.value) || 0 }))} />
                  </div>
                ))}
                <Button onClick={handleSaveSettings} className="w-full"><Save className="h-4 w-4 mr-1" /> Lưu</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add staff dialog */}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(emptyStaff); setEditingId(null); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Thêm đoàn viên</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? 'Sửa thông tin đoàn viên' : 'Thêm đoàn viên mới'}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Họ và tên</Label>
                  <Input value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} placeholder="Nguyễn Văn A" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tổ công đoàn</Label>
                  <Select value={form.department} onValueChange={v => setForm(p => ({ ...p, department: v }))}>
                    <SelectTrigger><SelectValue placeholder="Chọn tổ công đoàn..." /></SelectTrigger>
                    <SelectContent>
                      {unionGroupNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Chức vụ</Label>
                  <PositionCombobox value={form.position} onChange={v => setForm(p => ({ ...p, position: v }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ngày sinh</Label>
                  <Input type="date" value={form.birthDate} onChange={e => setForm(p => ({ ...p, birthDate: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Giới tính</Label>
                  <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v as 'nam' | 'nu' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nam">Nam</SelectItem>
                      <SelectItem value="nu">Nữ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hệ số lương</Label>
                  <Input type="number" step="0.01" value={form.salaryCoefficient} onChange={e => setForm(p => ({ ...p, salaryCoefficient: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Lương vùng (VNĐ)</Label>
                  <Input type="number" value={form.regionalSalary} onChange={e => setForm(p => ({ ...p, regionalSalary: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Hệ số chức vụ</Label>
                  <Input type="number" step="0.01" value={form.positionCoefficient} onChange={e => setForm(p => ({ ...p, positionCoefficient: Number(e.target.value) || 0 }))} />
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full"><Save className="h-4 w-4 mr-1" /> {editingId ? 'Cập nhật' : 'Thêm'}</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 no-print">
        <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-border"><CardContent className="p-6 space-y-3"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tổng đoàn viên</p><p className="font-serif text-3xl font-bold text-foreground">{list.length}</p></CardContent></Card>
        <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-border"><CardContent className="p-6 space-y-3"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Lương cơ sở</p><p className="font-serif text-3xl font-bold text-foreground">{fmt(settings.baseSalary)} <span className="text-sm font-medium text-muted-foreground underline">đ</span></p></CardContent></Card>
        <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-border"><CardContent className="p-6 space-y-3"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Tổng đoàn phí CĐ/tháng</p><p className="font-serif text-3xl font-bold text-primary">{fmt(Math.round(totalUnionFee))} <span className="text-sm font-medium text-muted-foreground underline">đ</span></p></CardContent></Card>
      </div>


      {/* Filter tabs by union group */}
      <div className="no-print">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="all" className="text-xs">
              Tất cả <Badge variant="secondary" className="ml-1 text-[10px]">{list.length}</Badge>
            </TabsTrigger>
            {unionGroupNames.map(name => (
              <TabsTrigger key={name} value={name} className="text-xs">
                {name.length > 30 ? name.substring(0, 30) + '...' : name}
                <Badge variant="secondary" className="ml-1 text-[10px]">{groupedByDept[name]?.length || 0}</Badge>
              </TabsTrigger>
            ))}
            {Object.keys(groupedByDept).filter(d => !unionGroupNames.includes(d)).map(d => (
              <TabsTrigger key={d} value={d} className="text-xs">
                {d} <Badge variant="secondary" className="ml-1 text-[10px]">{groupedByDept[d]?.length || 0}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <Card className="no-print">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 text-center">STT</TableHead>
                  <TableHead>Họ và tên</TableHead>
                  <TableHead>Tổ công đoàn</TableHead>
                  <TableHead>Chức vụ</TableHead>
                  <TableHead className="text-center">Ngày sinh</TableHead>
                  <TableHead className="text-center">GT</TableHead>
                  <TableHead className="text-right">HS lương</TableHead>
                  <TableHead className="text-right">HS CV</TableHead>
                  <TableHead className="text-right">Lương vùng</TableHead>
                  <TableHead className="text-right">Lương BH</TableHead>
                  <TableHead className="text-right">Đoàn phí CĐ</TableHead>
                  <TableHead className="w-16 text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center py-8 text-muted-foreground">Chưa có đoàn viên nào. Nhấn "Thêm đoàn viên" để bắt đầu.</TableCell></TableRow>
                )}
                {filteredList.map((s, i) => {
                  const lbh = calculateInsuranceSalary(s.salaryCoefficient, s.positionCoefficient, s.regionalSalary, settings.baseSalary);
                  const fee = calculateUnionFee(lbh, settings.baseSalary);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-center text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{s.fullName}</TableCell>
                      <TableCell className="text-sm">{s.department}</TableCell>
                      <TableCell className="text-sm">{s.position}</TableCell>
                      <TableCell className="text-center text-sm">{s.birthDate ? new Date(s.birthDate).toLocaleDateString('vi-VN') : ''}</TableCell>
                      <TableCell className="text-center text-sm">{s.gender === 'nam' ? 'Nam' : 'Nữ'}</TableCell>
                      <TableCell className="text-right font-mono">{s.salaryCoefficient.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{s.positionCoefficient.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(s.regionalSalary)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(Math.round(lbh))}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmt(Math.round(fee))}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(s)}>
                              <Pencil className="h-4 w-4 mr-2" /> Sửa thông tin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenTransfer(s, 'move')}>
                              <ArrowRightLeft className="h-4 w-4 mr-2" /> Điều chuyển tổ
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenTransfer(s, 'out')} className="text-destructive focus:text-destructive">
                              <LogOut className="h-4 w-4 mr-2" /> Chuyển khỏi ngành
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transfer dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{transferType === 'out' ? 'Chuyển ra khỏi ngành' : 'Điều chuyển đoàn viên'}</DialogTitle>
            <DialogDescription>
              {transferTarget && (
                <span>Đoàn viên: <strong>{transferTarget.fullName}</strong> — Tổ hiện tại: <strong>{transferTarget.department}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>
          {transferType === 'move' ? (
            <div className="space-y-3 py-2">
              <Label className="text-xs text-muted-foreground">Chuyển đến tổ công đoàn</Label>
              <Select value={transferDept} onValueChange={setTransferDept}>
                <SelectTrigger><SelectValue placeholder="Chọn tổ công đoàn đích..." /></SelectTrigger>
                <SelectContent>
                  {unionGroupNames.filter(n => n !== transferTarget?.department).map(name => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="py-2">
              <p className="text-sm text-muted-foreground">
                Xác nhận chuyển <strong>{transferTarget?.fullName}</strong> ra khỏi ngành? Đoàn viên sẽ bị xóa khỏi danh sách.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleTransfer} variant={transferType === 'out' ? 'destructive' : 'default'}>
              {transferType === 'out' ? 'Xác nhận chuyển' : 'Điều chuyển'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer history dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Lịch sử điều chuyển đoàn viên
            </DialogTitle>
            <DialogDescription>Danh sách các lần điều chuyển, luân chuyển đoàn viên</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            {transferHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">Chưa có lịch sử điều chuyển</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-10">STT</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Đoàn viên</TableHead>
                    <TableHead>Từ tổ</TableHead>
                    <TableHead>Đến tổ</TableHead>
                    <TableHead>Loại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transferHistory.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm">{new Date(r.date).toLocaleDateString('vi-VN')}</TableCell>
                      <TableCell className="font-medium">{r.staffName}</TableCell>
                      <TableCell className="text-sm">{r.fromDepartment}</TableCell>
                      <TableCell className="text-sm">{r.toDepartment}</TableCell>
                      <TableCell>
                        <Badge variant={r.type === 'out' ? 'destructive' : 'default'} className="text-[10px]">
                          {r.type === 'out' ? 'Ra khỏi ngành' : 'Điều chuyển'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Bulk transfer dialog */}
      <Dialog open={bulkTransferOpen} onOpenChange={setBulkTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" /> Điều chuyển đoàn viên
            </DialogTitle>
            <DialogDescription>Chọn đoàn viên và tổ công đoàn đích để điều chuyển</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Chọn đoàn viên</Label>
              <Select value={bulkTransferStaff} onValueChange={setBulkTransferStaff}>
                <SelectTrigger><SelectValue placeholder="Chọn đoàn viên..." /></SelectTrigger>
                <SelectContent>
                  {list.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.fullName} — {s.department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Hình thức</Label>
              <Select value={bulkTransferType} onValueChange={v => setBulkTransferType(v as 'move' | 'out')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="move">Điều chuyển sang tổ khác</SelectItem>
                  <SelectItem value="out">Chuyển ra khỏi ngành</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bulkTransferType === 'move' && (
              <div>
                <Label className="text-xs text-muted-foreground">Chuyển đến tổ công đoàn</Label>
                <Select value={bulkTransferDept} onValueChange={setBulkTransferDept}>
                  <SelectTrigger><SelectValue placeholder="Chọn tổ đích..." /></SelectTrigger>
                  <SelectContent>
                    {unionGroupNames.filter(n => {
                      const staff = list.find(s => s.id === bulkTransferStaff);
                      return n !== staff?.department;
                    }).map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTransferOpen(false)}>Hủy</Button>
            <Button onClick={handleBulkTransfer} variant={bulkTransferType === 'out' ? 'destructive' : 'default'}>
              {bulkTransferType === 'out' ? 'Xác nhận chuyển' : 'Điều chuyển'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="bg-muted/30 no-print">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p><strong>Công thức tính:</strong></p>
          <p>• Lương BH = (Hệ số lương × Lương vùng) + (Hệ số chức vụ × Lương cơ sở)</p>
          <p>• Đoàn phí CĐ = Lương BH × 0,5% (nhưng không quá 10% × Lương cơ sở)</p>
          <p>• Trần đoàn phí hiện tại: {fmt(Math.round(settings.baseSalary * 0.1))} ₫/tháng</p>
        </CardContent>
      </Card>

      {/* Print views */}
      <div ref={printRef} className="print-only print-landscape">
        {printMode === 'fee' ? (
          <PrintMonthlyFee month={feeMonth} year={feeYear} />
        ) : (
          <PrintStaffList />
        )}
      </div>
    </div>
  );
}

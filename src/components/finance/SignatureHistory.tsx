import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { History, Search, CheckCircle, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface SignatureRecord {
  id: string;
  voucher_id: string;
  voucher_type: string;
  signed_at: string;
  signer_name: string;
  signer_role: string;
}

const TYPE_LABELS: Record<string, string> = {
  thu: 'Phiếu Thu',
  chi: 'Phiếu Chi',
};

const ROLE_LABELS: Record<string, string> = {
  lanh_dao: 'Lãnh đạo',
  ke_toan: 'Kế toán',
  nguoi_lap: 'Người lập',
  admin: 'Quản trị viên',
};

export function SignatureHistory() {
  const { hasRole } = useAuth();
  const [records, setRecords] = useState<SignatureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const isKeHoan = hasRole('ke_toan');
  const isLanhDao = hasRole('lanh_dao');
  const isAdmin = hasRole('admin');

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);

      const { fetchDirectoryProfiles, fetchDirectoryUserRoles } = await import('@/lib/directory');
      const [sigsRes, profiles, roles] = await Promise.all([
        supabase.from('voucher_signatures').select('*').order('signed_at', { ascending: false }),
        fetchDirectoryProfiles(true),
        fetchDirectoryUserRoles(true),
      ]);

      const nameMap = new Map<string, string>();
      profiles.forEach(p => nameMap.set(p.user_id, p.full_name));

      const roleMap = new Map<string, string>();
      roles.forEach(r => {
        if (!roleMap.has(r.user_id) || r.role === 'lanh_dao' || r.role === 'ke_toan') {
          roleMap.set(r.user_id, r.role);
        }
      });

      const mapped: SignatureRecord[] = (sigsRes.data || []).map(s => ({
        id: s.id,
        voucher_id: s.voucher_id,
        voucher_type: s.voucher_type,
        signed_at: s.signed_at,
        signer_name: nameMap.get(s.signer_id) || 'Không rõ',
        signer_role: roleMap.get(s.signer_id) || '',
      }));

      setRecords(mapped);
      setLoading(false);
    };

    fetchHistory();
  }, []);

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.voucher_id.toLowerCase().includes(search.toLowerCase()) ||
      r.signer_name.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || r.signer_role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <History className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Lịch sử ký duyệt</h1>
          <p className="text-muted-foreground">Xem toàn bộ lịch sử ký duyệt chứng từ</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Danh sách chữ ký ({filtered.length})
          </CardTitle>
          <CardDescription>
            <div className="flex flex-wrap gap-3 mt-2">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Tìm theo số phiếu hoặc người ký..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Lọc theo chức vụ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả chức vụ</SelectItem>
                  <SelectItem value="lanh_dao">Lãnh đạo</SelectItem>
                  <SelectItem value="ke_toan">Kế toán</SelectItem>
                  <SelectItem value="nguoi_lap">Người lập</SelectItem>
                  <SelectItem value="admin">Quản trị viên</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Chưa có lịch sử ký duyệt</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian ký</TableHead>
                  <TableHead>Loại chứng từ</TableHead>
                  <TableHead>Số phiếu</TableHead>
                  <TableHead>Người ký</TableHead>
                  <TableHead>Chức vụ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">
                      {format(new Date(r.signed_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TYPE_LABELS[r.voucher_type] || r.voucher_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{r.voucher_id}</TableCell>
                    <TableCell>{r.signer_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {ROLE_LABELS[r.signer_role] || r.signer_role}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

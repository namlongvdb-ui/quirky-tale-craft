import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Paperclip, Upload, Trash2, FileText, Loader2, Download } from 'lucide-react';

const BUCKET = 'voucher-attachments';

export type DocType = 'hoa_don' | 'to_trinh' | 'du_toan' | 'khac';

const DOC_TABS: { key: DocType; label: string }[] = [
  { key: 'hoa_don', label: 'Hóa đơn' },
  { key: 'to_trinh', label: 'Tờ trình' },
  { key: 'du_toan', label: 'Dự toán' },
  { key: 'khac', label: 'Khác' },
];

interface Attachment {
  id: string;
  doc_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface Props {
  voucherType: string;
  voucherId: string;
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function VoucherAttachments({ voucherType, voucherId }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<DocType>('hoa_don');
  const [items, setItems] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!voucherId) { setItems([]); return; }
    const { data, error } = await supabase
      .from('voucher_attachments')
      .select('id, doc_type, file_name, file_path, file_size, created_at')
      .eq('voucher_type', voucherType)
      .eq('voucher_id', voucherId)
      .order('created_at', { ascending: false });
    if (error) { setItems([]); return; }
    setItems(data ?? []);
  }, [voucherType, voucherId]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!user) { toast.error('Vui lòng đăng nhập lại'); return; }
    if (!voucherId) { toast.error('Chưa có số hiệu chứng từ'); return; }
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name}: vượt quá 20MB`);
          continue;
        }
        const safeName = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${user.id}/${voucherType}/${voucherId}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); continue; }
        const { error: dbErr } = await supabase.from('voucher_attachments').insert({
          voucher_id: voucherId,
          voucher_type: voucherType,
          doc_type: tab,
          file_name: file.name,
          file_path: path,
          file_size: file.size,
          mime_type: file.type || null,
          uploaded_by: user.id,
        });
        if (dbErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          toast.error(`${file.name}: ${dbErr.message}`);
          continue;
        }
        toast.success(`Đã tải lên ${file.name}`);
      }
      await load();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const openFile = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(att.file_path, 300);
    if (error || !data) { toast.error('Không mở được tệp'); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const removeFile = async (att: Attachment) => {
    if (!confirm(`Xóa hồ sơ "${att.file_name}"?`)) return;
    const { error } = await supabase.from('voucher_attachments').delete().eq('id', att.id);
    if (error) { toast.error(error.message); return; }
    await supabase.storage.from(BUCKET).remove([att.file_path]);
    toast.success('Đã xóa hồ sơ');
    load();
  };

  const visible = items.filter(i => i.doc_type === tab);

  return (
    <Card className="rounded-2xl shadow-sm border-0 ring-1 ring-border overflow-hidden mt-6 no-print">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-serif text-base font-semibold text-foreground">Hồ sơ đính kèm kỹ thuật số</h3>
          <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
            {voucherId || 'Chưa có số hiệu'}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {DOC_TABS.map(t => {
            const count = items.filter(i => i.doc_type === t.key).length;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ring-1 ${
                  active
                    ? 'bg-primary text-primary-foreground ring-primary'
                    : 'bg-muted/40 text-muted-foreground ring-border hover:bg-accent'
                }`}
              >
                {t.label}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground mb-3">
            Tải lên ảnh chụp / PDF hồ sơ {DOC_TABS.find(t => t.key === tab)?.label.toLowerCase()} (tối đa 20MB mỗi tệp)
          </p>
          <Button type="button" variant="outline" size="sm" disabled={busy || !voucherId} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Chọn tệp
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {visible.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Chưa có hồ sơ trong mục này</p>
          )}
          {visible.map(att => (
            <div key={att.id} className="flex items-center gap-3 rounded-lg bg-muted/40 ring-1 ring-border px-3 py-2">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{att.file_name}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {formatSize(att.file_size)} · {new Date(att.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Xem tệp" onClick={() => openFile(att)}>
                <Download className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Xóa" onClick={() => removeFile(att)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

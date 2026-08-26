import { useState, useEffect } from 'react';
import { voucherSignaturesApi, profilesApi, rolesApi, digitalSignaturesApi } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { verifySignature } from '@/lib/crypto-utils';
import { Transaction } from '@/types/finance';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, ShieldAlert, PenTool, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { signVoucherWith3StepNotify } from '@/lib/signing-flow';
import { cn } from '@/lib/utils';

interface SignatureInfo {
  signer_id: string;
  signer_name: string;
  signed_at: string;
  is_valid: boolean | null;
  role: string;
}

interface VoucherSignatureProps {
  transaction: Transaction;
  voucherType: 'thu' | 'chi' | 'tham-hoi' | 'de-nghi';
  compact?: boolean;
  /** Ẩn nút ký trên danh sách (phiếu thu/chi ký ngay khi lập + chờ ký tại màn hình chờ ký) */
  hideSignAction?: boolean;
}

function buildVoucherDataString(tx: Transaction): string {
  return JSON.stringify({
    voucherNo: tx.voucherNo,
    date: tx.date,
    amount: tx.amount,
    description: tx.description,
    personName: tx.personName,
    type: tx.type,
  });
}

export function VoucherSignatureStatus({ transaction, voucherType }: VoucherSignatureProps) {
  const [signatures, setSignatures] = useState<SignatureInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSignatures();
  }, [transaction.voucherNo]);

  const fetchSignatures = async () => {
    setLoading(true);
    const { data: sigs } = await voucherSignaturesApi.get(transaction.voucherNo, voucherType);

    if (sigs && sigs.length > 0) {
      const signerIds = sigs.map((s: any) => s.signer_id);
      const [profilesRes, rolesRes] = await Promise.all([
        profilesApi.getAll(),
        rolesApi.getAll(),
      ]);

      const infos: SignatureInfo[] = sigs.map((s: any) => {
        const profile = profilesRes.data?.find((p: any) => p.user_id === s.signer_id);
        const role = rolesRes.data?.find((r: any) => r.user_id === s.signer_id);
        return {
          signer_id: s.signer_id,
          signer_name: profile?.full_name || 'Unknown',
          signed_at: s.signed_at,
          is_valid: null,
          role: role?.role || '',
        };
      });
      setSignatures(infos);
    } else {
      setSignatures([]);
    }
    setLoading(false);
  };

  if (loading) return <Badge variant="outline" className="text-xs">...</Badge>;

  if (signatures.length === 0) {
    return (
      <Badge variant="secondary" className="text-[10px] font-bold text-muted-foreground/50 bg-muted/50 uppercase tracking-widest px-2 py-0">
        Chờ ký
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {signatures.map(sig => (
        <Badge
          key={sig.signer_id}
          variant="outline"
          className="text-[10px] font-bold bg-emerald-50/50 text-emerald-700 border-emerald-200/50 px-2 py-0.5 shadow-sm group/sig transition-all hover:bg-emerald-100/50"
          title={`${sig.signer_name} - ${sig.role === 'lanh_dao' ? 'Lãnh đạo' : sig.role === 'ke_toan' ? 'Kế toán' : sig.role === 'phu_trach_dia_ban' ? 'Phụ trách địa bàn' : sig.role === 'nguoi_lap' ? 'Người lập' : sig.role}`}
        >
          <ShieldCheck className="w-2.5 h-2.5 mr-1 text-emerald-600" />
          <span className="truncate max-w-[80px]">{sig.signer_name}</span>
        </Badge>
      ))}
    </div>
  );
}

export function SignVoucherButton({ transaction, voucherType, onSigned, hideSignAction }: VoucherSignatureProps & { onSigned?: () => void }) {
  const { user, profile, hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [signing, setSigning] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; details: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [signPassword, setSignPassword] = useState('');

  const canSign = voucherType === 'tham-hoi'
    ? (hasRole('lanh_dao') || hasRole('phu_trach_dia_ban'))
    : (voucherType === 'de-nghi' ? (hasRole('lanh_dao') || hasRole('ke_toan')) : hasRole('lanh_dao'));

  useEffect(() => {
    if (user && canSign) {
      checkIfSigned();
    }
  }, [user, transaction.voucherNo]);

  const checkIfSigned = async () => {
    if (!user) return;
    const { data } = await voucherSignaturesApi.get(transaction.voucherNo, voucherType, user.id);
    setAlreadySigned(!!(data && data.length > 0));
  };

  const handleSign = async () => {
    if (!user) return;
    setSigning(true);

    const signerName = profile?.full_name || 'Người ký';
    const res = await signVoucherWith3StepNotify({
      voucherId: transaction.voucherNo,
      voucherType,
      voucherData: transaction as any,
      signerId: user.id,
      signerName,
      signPassword,
      creatorId: transaction.createdBy,
    });

    if (res.ok) {
      setAlreadySigned(true);
      onSigned?.();
    }
    setSigning(false);
    setDialogOpen(false);
    setSignPassword('');
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const { data: sigs } = await voucherSignaturesApi.get(transaction.voucherNo, voucherType);

      if (!sigs || sigs.length === 0) {
        setVerifyResult({ valid: false, details: 'Chưa có chữ ký nào trên phiếu này' });
        setVerifying(false);
        return;
      }

      const dataString = buildVoucherDataString(transaction);
      const results: string[] = [];
      let allValid = true;

      for (const sig of sigs) {
        const { data: sigKeys } = await digitalSignaturesApi.get(sig.signer_id, true);
        const { data: profile } = await profilesApi.getByUserId(sig.signer_id);

        const name = profile?.full_name || sig.signer_id;
        const sigKey = sigKeys && sigKeys.length > 0 ? sigKeys[0] : null;

        if (!sigKey) {
          results.push(`❌ ${name}: Không tìm thấy khóa công khai`);
          allValid = false;
          continue;
        }

        const valid = await verifySignature(sigKey.public_key, sig.signature, dataString);
        if (valid) {
          results.push(`✅ ${name}: Chữ ký hợp lệ`);
        } else {
          results.push(`❌ ${name}: Chữ ký KHÔNG hợp lệ (dữ liệu có thể đã bị thay đổi)`);
          allValid = false;
        }
      }

      setVerifyResult({ valid: allValid, details: results.join('\n') });
    } catch (err: any) {
      setVerifyResult({ valid: false, details: `Lỗi xác thực: ${err.message}` });
    }
    setVerifying(false);
  };

  if (!user) return null;

  const showSign = canSign && !hideSignAction;

  return (
    <>
      <div className="flex gap-1.5 justify-center">
        {showSign && (
          <Button
            size="sm"
            variant={alreadySigned ? 'secondary' : 'default'}
            className={cn(
              "h-8 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all shadow-sm",
              alreadySigned ? "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100" : "bg-primary hover:bg-primary/90 shadow-primary/20"
            )}
            onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
            disabled={alreadySigned}
          >
            {alreadySigned ? (
              <><CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> ĐÃ KÝ</>
            ) : (
              <><PenTool className="w-3.5 h-3.5 mr-1.5" /> KÝ DUYỆT</>
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg border-2 border-muted/50 hover:bg-muted transition-all"
          onClick={(e) => { e.stopPropagation(); handleVerify(); }}
          disabled={verifying}
        >
          {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />}
          XÁC THỰC
        </Button>
      </div>

      {verifyResult && (
        <Dialog open={!!verifyResult} onOpenChange={() => setVerifyResult(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {verifyResult.valid ? (
                  <><CheckCircle2 className="w-5 h-5 text-green-600" /> Chữ ký hợp lệ</>
                ) : (
                  <><XCircle className="w-5 h-5 text-red-600" /> Cảnh báo</>
                )}
              </DialogTitle>
              <DialogDescription>
                Kết quả xác thực chữ ký số phiếu {transaction.voucherNo}
              </DialogDescription>
            </DialogHeader>
            <div className="whitespace-pre-line text-sm p-4 bg-muted rounded-lg">
              {verifyResult.details}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-primary" />
              Ký duyệt chứng từ
            </DialogTitle>
            <DialogDescription>
              Xác nhận ký duyệt phiếu {transaction.voucherNo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg">
              <div>
                <span className="text-muted-foreground">Số phiếu:</span>
                <p className="font-semibold">{transaction.voucherNo}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Ngày:</span>
                <p className="font-semibold">{new Date(transaction.date).toLocaleDateString('vi-VN')}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Số tiền:</span>
                <p className="font-semibold">{transaction.amount.toLocaleString('vi-VN')} ₫</p>
              </div>
              <div>
                <span className="text-muted-foreground">Loại:</span>
                <p className="font-semibold">{voucherType === 'thu' ? 'Phiếu thu' : 'Phiếu chi'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Nội dung:</span>
                <p className="font-semibold">{transaction.description}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sign-password">Mật khẩu ký số</Label>
              <Input
                id="sign-password"
                type="password"
                value={signPassword}
                onChange={e => setSignPassword(e.target.value)}
                placeholder="Nhập mật khẩu ký số..."
                onKeyDown={e => e.key === 'Enter' && handleSign()}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Nhập mật khẩu ký số để giải mã khóa bí mật và ký duyệt chứng từ.
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Hủy
              </Button>
              <Button onClick={handleSign} disabled={signing || !signPassword} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {signing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PenTool className="w-4 h-4 mr-2" />}
                Xác nhận ký
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

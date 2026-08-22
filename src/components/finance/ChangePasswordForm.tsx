import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { decryptPrivateKey, encryptPrivateKey } from '@/lib/crypto-utils';

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Signature password change state
  const { user } = useAuth();
  const [sigCurrentPassword, setSigCurrentPassword] = useState('');
  const [sigNewPassword, setSigNewPassword] = useState('');
  const [sigConfirmPassword, setSigConfirmPassword] = useState('');
  const [sigLoading, setSigLoading] = useState(false);
  const [showSigCurrent, setShowSigCurrent] = useState(false);
  const [showSigNew, setShowSigNew] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      // Verify current password by re-signing in
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Không tìm thấy thông tin người dùng');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        toast.error('Mật khẩu hiện tại không đúng');
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    }
    setLoading(false);
  };

  const handleSignaturePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (sigNewPassword.length < 6) {
      toast.error('Mật khẩu ký số mới phải có ít nhất 6 ký tự');
      return;
    }
    if (sigNewPassword !== sigConfirmPassword) {
      toast.error('Mật khẩu ký số xác nhận không khớp');
      return;
    }
    if (!user) {
      toast.error('Không tìm thấy thông tin người dùng');
      return;
    }

    setSigLoading(true);
    try {
      // Fetch encrypted private key from DB
      const { data: sigData, error: fetchError } = await supabase
        .from('digital_signatures')
        .select('encrypted_private_key')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (fetchError || !sigData?.encrypted_private_key) {
        toast.error('Không tìm thấy khóa ký số. Liên hệ quản trị viên để được cấp khóa.');
        setSigLoading(false);
        return;
      }

      // Decrypt with current password
      let privateKey: string;
      try {
        privateKey = await decryptPrivateKey(sigData.encrypted_private_key, sigCurrentPassword);
      } catch {
        toast.error('Mật khẩu ký số hiện tại không đúng');
        setSigLoading(false);
        return;
      }

      // Re-encrypt with new password
      const newEncryptedKey = await encryptPrivateKey(privateKey, sigNewPassword);

      // Update in DB
      const { error: updateError } = await supabase
        .from('digital_signatures')
        .update({ encrypted_private_key: newEncryptedKey })
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (updateError) throw updateError;

      toast.success('Đổi mật khẩu ký số thành công!');
      setSigCurrentPassword('');
      setSigNewPassword('');
      setSigConfirmPassword('');
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    }
    setSigLoading(false);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-border pb-6">
        <h1 className="font-serif text-3xl md:text-4xl font-bold uppercase tracking-tight text-foreground">
          Bảo mật tài khoản
        </h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="h-4 w-4 text-primary" />
          Quản lý mật khẩu đăng nhập và mật khẩu chữ ký số cá nhân
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Login password change */}
      <Card className="border-0 rounded-2xl shadow-sm ring-1 ring-border overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30 flex-row items-center gap-4 space-y-0 py-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </span>
          <div className="space-y-1">
            <CardTitle className="font-serif text-lg font-bold uppercase tracking-wide">
              Mật khẩu đăng nhập
            </CardTitle>
            <CardDescription className="text-[10px] font-semibold uppercase tracking-[0.16em]">
              Thay đổi mật mã truy cập hệ thống
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Mật khẩu hiện tại</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowCurrent(!showCurrent)}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu mới</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowNew(!showNew)}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu mới</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
              Đổi mật khẩu
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Signature password change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Đổi mật khẩu ký số
          </CardTitle>
          <CardDescription>Thay đổi mật khẩu dùng để ký duyệt chứng từ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignaturePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label>Mật khẩu ký số hiện tại</Label>
              <div className="relative">
                <Input
                  type={showSigCurrent ? 'text' : 'password'}
                  value={sigCurrentPassword}
                  onChange={e => setSigCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu ký số hiện tại"
                  required
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSigCurrent(!showSigCurrent)}>
                  {showSigCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu ký số mới</Label>
              <div className="relative">
                <Input
                  type={showSigNew ? 'text' : 'password'}
                  value={sigNewPassword}
                  onChange={e => setSigNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu ký số mới"
                  required
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowSigNew(!showSigNew)}>
                  {showSigNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Xác nhận mật khẩu ký số mới</Label>
              <Input
                type="password"
                value={sigConfirmPassword}
                onChange={e => setSigConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu ký số mới"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Mật khẩu ký số dùng để bảo vệ khóa bí mật của bạn. Nếu quên mật khẩu ký số, liên hệ quản trị viên để được cấp lại.
            </p>
            <Button type="submit" disabled={sigLoading} className="w-full">
              {sigLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
              Đổi mật khẩu ký số
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

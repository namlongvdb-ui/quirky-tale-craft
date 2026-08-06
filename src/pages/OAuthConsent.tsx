import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const { user, signIn } = useAuth();
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Thiếu authorization_id");
        return;
      }
      if (!user) return;
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, user]);

  async function decide(approve: boolean) {
    setBusy(true);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Máy chủ xác thực không trả về địa chỉ chuyển tiếp.");
      return;
    }
    window.location.href = target;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = username.includes("@") ? username : `${username}@app.local`;
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError("Tên đăng nhập hoặc mật khẩu không đúng");
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">{children}</Card>
    </main>
  );

  if (!user) {
    return shell(
      <>
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <CardTitle>Đăng nhập để tiếp tục</CardTitle>
          <CardDescription>Một ứng dụng bên ngoài đang yêu cầu kết nối với tài khoản của bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oauth-username">Tên đăng nhập</Label>
              <Input id="oauth-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oauth-password">Mật khẩu</Label>
              <Input
                id="oauth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
        </CardContent>
      </>
    );
  }

  if (error) {
    return shell(
      <CardHeader>
        <CardTitle>Không thể xử lý yêu cầu</CardTitle>
        <CardDescription>{error}</CardDescription>
      </CardHeader>
    );
  }

  if (!details) {
    return shell(
      <CardHeader>
        <CardTitle>Đang tải…</CardTitle>
      </CardHeader>
    );
  }

  const clientName = details.client?.name ?? "Ứng dụng bên ngoài";

  return shell(
    <>
      <CardHeader className="space-y-2">
        <CardTitle>Kết nối {clientName}</CardTitle>
        <CardDescription>
          {clientName} sẽ được truy cập dữ liệu tài chính của bạn trong hệ thống này với quyền của chính bạn.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-3">
        <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
          Đồng ý
        </Button>
        <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>
          Từ chối
        </Button>
      </CardContent>
    </>
  );
}

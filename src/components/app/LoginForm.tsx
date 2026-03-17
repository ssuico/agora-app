import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

interface LoginResponse {
  role?: string;
  name?: string;
  storeIds?: string[];
  message?: string;
}

function getRedirectUrl(data: LoginResponse): string {
  switch (data.role) {
    case 'admin':
      return '/admin/dashboard';
    case 'store_manager': {
      if (data.storeIds?.length === 1) {
        return `/store/${data.storeIds[0]}`;
      }
      return '/store/select';
    }
    case 'customer':
      return '/select-location';
    default:
      return '/login';
  }
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = (await res.json()) as LoginResponse;

      if (!res.ok) {
        const msg = data.message ?? 'Login failed. Please try again.';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success('Signed in successfully');
      window.location.href = getRedirectUrl(data);
    } catch {
      const msg = 'Network error. Please check your connection.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full border-white/45 bg-white/75 shadow-[0_25px_80px_-40px_rgba(15,54,21,0.75)] backdrop-blur-md">
      <CardHeader className="space-y-2 pb-5 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-800/15 bg-emerald-700/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900">
          <ShieldCheck className="size-3.5" />
          Secure Access
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight text-emerald-950">Agora POS</CardTitle>
        <CardDescription className="text-emerald-800/80">
          Sign in to continue to your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-emerald-900">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-emerald-900/50" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 border-emerald-900/15 bg-white/80 pl-9 text-emerald-950 placeholder:text-emerald-900/45 focus-visible:border-emerald-700 focus-visible:ring-emerald-600/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-emerald-900">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-emerald-900/50" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 border-emerald-900/15 bg-white/80 pl-9 pr-11 text-emerald-950 placeholder:text-emerald-900/45 focus-visible:border-emerald-700 focus-visible:ring-emerald-600/30"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-emerald-900/65 transition hover:bg-emerald-900/10 hover:text-emerald-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/40"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button
            type="submit"
            className="h-11 w-full bg-emerald-800 text-white shadow-[0_14px_35px_-15px_rgba(16,78,36,0.9)] transition hover:bg-emerald-700"
            disabled={loading}
          >
            {loading ? (
              'Signing in...'
            ) : (
              <span className="inline-flex items-center gap-2">
                Sign in
                <ArrowRight className="size-4" />
              </span>
            )}
          </Button>
          <p className="text-center text-xs text-emerald-900/60">Protected by role-based account access.</p>
        </form>
      </CardContent>
    </Card>
  );
}

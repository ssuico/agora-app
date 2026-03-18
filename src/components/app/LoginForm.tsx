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
    <Card className="w-full border-border/70 bg-background/80 shadow-[0_25px_80px_-40px_rgba(38,42,86,0.58)] backdrop-blur-md">
      <CardHeader className="space-y-2 pb-5 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          <ShieldCheck className="size-3.5" />
          Secure Access
        </div>
        <CardTitle className="text-3xl font-bold tracking-tight text-foreground">Agora POS</CardTitle>
        <CardDescription className="text-foreground/75">
          Sign in to continue to your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">
              Email
            </Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 border-input bg-background/85 pl-9 text-foreground placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11 border-input bg-background/85 pl-9 pr-11 text-foreground placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-primary/30"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-foreground/65 transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
            className="h-11 w-full bg-primary text-primary-foreground shadow-[0_14px_35px_-15px_rgba(38,42,86,0.9)] transition hover:bg-primary/90"
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
          <p className="text-center text-xs text-foreground/60">Protected by role-based account access.</p>
        </form>
      </CardContent>
    </Card>
  );
}

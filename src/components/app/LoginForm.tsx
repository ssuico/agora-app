import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

interface LoginResponse {
  role?: string;
  roles?: string[];
  name?: string;
  storeIds?: string[];
  message?: string;
}

const ROLE_ORDER = ['admin', 'store_manager', 'customer'] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  store_manager: 'Store Manager',
  customer: 'Customer',
};

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
  const [emailResetEnabled, setEmailResetEnabled] = useState(false);
  const [pendingSession, setPendingSession] = useState<LoginResponse | null>(null);
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    fetch('/api/auth/options')
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as { emailVerificationEnabled?: boolean };
        setEmailResetEnabled(data.emailVerificationEnabled === true);
      })
      .catch(() => {
        setEmailResetEnabled(false);
      });
  }, []);

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

      toast.success('Signed In');
      const roles = Array.isArray(data.roles) ? data.roles : [];
      if (roles.length > 1) {
        setPendingSession({ ...data, roles });
        return;
      }
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
    <Card className="w-full border-0 bg-transparent py-0 shadow-none">
      <CardHeader className="gap-3 pb-6 text-center">
        <CardTitle>
          <h1 className="auth-wordmark text-primary" translate="no">Agora</h1>
        </CardTitle>
        <CardDescription className="text-base font-medium tracking-wide text-foreground/75">
          <span className="sr-only">Shop, Reserve, Claim</span>
          <span className="auth-tagline" aria-hidden="true">
            <span className="auth-tagline-word">Shop</span>
            <span className="auth-tagline-sep">-</span>
            <span className="auth-tagline-word">Reserve</span>
            <span className="auth-tagline-sep">-</span>
            <span className="auth-tagline-word">Claim</span>
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {pendingSession ? (
          <div className="flex flex-col gap-3">
            <p className="text-center text-sm font-medium text-foreground">Choose a view</p>
            {ROLE_ORDER.filter((role) => pendingSession.roles?.includes(role)).map((role) => (
              <Button
                key={role}
                type="button"
                variant="outline"
                className="h-11 w-full justify-between"
                disabled={!!switchingRole}
                onClick={async () => {
                  setSwitchingRole(role);
                  setError('');
                  try {
                    const res = await fetch('/api/auth/switch-role', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ role }),
                    });
                    const switched = (await res.json()) as LoginResponse;
                    if (!res.ok) {
                      const msg = switched.message ?? 'Could not open that view';
                      setError(msg);
                      toast.error(msg);
                      setSwitchingRole(null);
                      return;
                    }
                    window.location.href = getRedirectUrl({
                      role: switched.role ?? role,
                      storeIds: switched.storeIds,
                    });
                  } catch {
                    const msg = 'Network error. Please check your connection.';
                    setError(msg);
                    toast.error(msg);
                    setSwitchingRole(null);
                  }
                }}
              >
                {switchingRole === role ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Opening…
                  </>
                ) : (
                  <>
                    {ROLE_LABELS[role] ?? role}
                    <ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </>
                )}
              </Button>
            ))}
            {error && (
              <Alert ref={errorRef} tabIndex={-1} variant="destructive" aria-live="polite" className="outline-none">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="email" className="text-foreground">
                Email
              </FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" aria-hidden="true" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@outdoorequipped.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  spellCheck={false}
                  className="h-11 border-input bg-background/85 pl-9 text-foreground placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="password" className="text-foreground">
                Password
              </FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" aria-hidden="true" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 border-input bg-background/85 pl-9 pr-11 text-foreground placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-primary/30"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </div>
              {emailResetEnabled && (
                <div className="flex justify-end">
                  <a href="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>
              )}
            </Field>
            {error && (
              <Alert ref={errorRef} tabIndex={-1} variant="destructive" aria-live="polite" className="outline-none">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="h-11 w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Signing In…
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </>
              )}
            </Button>
            <p className="text-center text-sm text-foreground/70">
              New here?{' '}
              <a href="/signup" className="font-semibold text-primary hover:underline">
                Create an Account
              </a>
            </p>
          </FieldGroup>
        </form>
        )}
      </CardContent>
    </Card>
  );
}

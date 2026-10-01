import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

type Step = 'email' | 'reset';

export function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailResetEnabled, setEmailResetEnabled] = useState<boolean | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    fetch('/api/auth/options')
      .then(async (res) => {
        if (!res.ok) {
          setEmailResetEnabled(false);
          return;
        }
        const data = (await res.json()) as { emailVerificationEnabled?: boolean };
        setEmailResetEnabled(data.emailVerificationEnabled === true);
      })
      .catch(() => setEmailResetEnabled(false));
  }, []);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        const msg = data.message ?? 'Could not send a reset code.';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Reset code sent');
      setStep('reset');
    } catch {
      const msg = 'Network error. Please check your connection.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      const msg = 'Enter the 6-digit code from your email.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (newPassword.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = 'Passwords do not match.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: code.trim(),
          newPassword,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        const msg = data.message ?? 'Could not reset your password.';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Password Updated');
      window.location.href = '/login';
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
      <CardHeader className="gap-4 pb-5 text-center">
        <CardTitle>
          <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground">Reset Password</h1>
        </CardTitle>
        <CardDescription className="text-pretty text-foreground/75 break-words">
          {step === 'email'
            ? 'We email a code when this address already has an account'
            : `Enter the code sent to ${email.trim()}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {emailResetEnabled === false ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-foreground/75">
              Email password reset is turned off. Sign in, or ask an admin to reset your password.
            </p>
            <a href="/login" className="inline-flex font-semibold text-primary hover:underline">
              Back to Sign In
            </a>
          </div>
        ) : emailResetEnabled === null ? (
          <p className="flex items-center justify-center gap-2 text-sm text-foreground/70">
            <Spinner />
            Loading…
          </p>
        ) : step === 'email' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-5">
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
                  Sending Code…
                </>
              ) : (
                <>
                  Email Me a Code
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </>
              )}
            </Button>
            <p className="text-center text-sm text-foreground/70">
              Remembered it?{' '}
              <a href="/login" className="font-semibold text-primary hover:underline">
                Sign In
              </a>
            </p>
          </form>
        ) : (
          <form onSubmit={confirmReset} className="flex flex-col gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="code" className="text-foreground">
                Reset code
              </FieldLabel>
              <Input
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                className="h-11 border-input bg-background/85 text-center text-lg tracking-[0.3em] text-foreground placeholder:tracking-normal placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="new-password" className="text-foreground">
                New password
              </FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" aria-hidden="true" />
                <Input
                  id="new-password"
                  name="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
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
            </Field>
            <Field className="gap-2">
              <FieldLabel htmlFor="confirm-password" className="text-foreground">
                Confirm new password
              </FieldLabel>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat the new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="h-11 border-input bg-background/85 text-foreground placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-primary/30"
              />
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
                  Updating Password…
                </>
              ) : (
                'Update Password'
              )}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 font-semibold"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
              >
                Use a Different Email
              </Button>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 font-semibold"
                disabled={loading}
                onClick={() => sendCode()}
              >
                Resend Code
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

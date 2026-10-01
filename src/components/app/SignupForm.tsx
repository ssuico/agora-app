import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

type Step = 'details' | 'code';

export function SignupForm() {
  const [step, setStep] = useState<Step>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      const msg = 'Enter your full name.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: email.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { message?: string; verificationRequired?: boolean };
      if (!res.ok) {
        const msg = data.message ?? 'Could not create account. Please try again.';
        setError(msg);
        toast.error(msg);
        return;
      }
      if (data.verificationRequired) {
        toast.success('Confirmation code sent');
        setStep('code');
        return;
      }
      toast.success('Account Created');
      window.location.href = '/select-location';
    } catch {
      const msg = 'Network error. Please check your connection.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      const msg = 'Enter the 6-digit code from your email.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        const msg = data.message ?? 'Could not confirm your email.';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Account Created');
      window.location.href = '/select-location';
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
          <h1 className="text-3xl font-bold tracking-tight text-balance text-foreground">
            {step === 'details' ? 'Create Account' : 'Enter Code'}
          </h1>
        </CardTitle>
        <CardDescription className="text-pretty text-foreground/75 break-words">
          {step === 'details'
            ? 'Use your Outdoor Equipped or Channel Precision email'
            : `Enter the code sent to ${email.trim()}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'details' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="name" className="text-foreground">
                Full name
              </FieldLabel>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/50" aria-hidden="true" />
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Jordan Lee"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  maxLength={100}
                  className="h-11 border-input bg-background/85 pl-9 text-foreground placeholder:text-foreground/45 focus-visible:border-primary focus-visible:ring-primary/30"
                />
              </div>
            </Field>
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
              <FieldDescription className="text-xs">
                @outdoorequipped.com and @channelprecision.com only.
              </FieldDescription>
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
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  Creating Account…
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight data-icon="inline-end" aria-hidden="true" />
                </>
              )}
            </Button>
            <p className="text-center text-sm text-foreground/70">
              Already have an account?{' '}
              <a href="/login" className="font-semibold text-primary hover:underline">
                Sign In
              </a>
            </p>
          </form>
        ) : (
          <form onSubmit={confirmCode} className="flex flex-col gap-5">
            <Field className="gap-2">
              <FieldLabel htmlFor="code" className="text-foreground">
                Confirmation code
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
              <FieldDescription className="text-xs">The code expires in 10 minutes.</FieldDescription>
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
                  Creating Account…
                </>
              ) : (
                'Confirm and Create Account'
              )}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 font-semibold"
                onClick={() => {
                  setStep('details');
                  setCode('');
                  setError('');
                }}
              >
                Edit Details
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

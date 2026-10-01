import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { AlertTriangle, ArrowLeft, CheckCircle2, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  storeIds?: string[];
}

function AvatarImageWithFallback({ src, name, className }: { src?: string; name: string; className?: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Avatar className={className}>
      {src?.trim() && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className="bg-secondary/55 font-semibold text-foreground">{initials}</AvatarFallback>
    </Avatar>
  );
}

export function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileForm, setProfileForm] = useState({ name: '', avatar: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchMe = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setProfileForm({ name: data.name ?? '', avatar: data.avatar ?? '' });
      }
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileSaving(true);
    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name.trim() || user.name,
          avatar: profileForm.avatar.trim(),
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Failed to update profile');
        return;
      }
      setUser({ ...user, ...data });
      setProfileForm({ name: data.name ?? '', avatar: data.avatar ?? '' });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleAddAvatarUrl = () => {
    const url = newAvatarUrl.trim();
    if (!url) return;
    setProfileForm((prev) => ({ ...prev, avatar: url }));
    setNewAvatarUrl('');
  };

  const handleClearAvatar = () => {
    setProfileForm((prev) => ({ ...prev, avatar: '' }));
    setNewAvatarUrl('');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    if (!oldPassword || !newPassword) {
      const message = 'Please fill in current and new password';
      setPasswordFeedback({ type: 'error', message });
      toast.error(message);
      return;
    }
    if (newPassword.length < 6) {
      const message = 'New password must be at least 6 characters';
      setPasswordFeedback({ type: 'error', message });
      toast.error(message);
      return;
    }
    if (newPassword !== confirmPassword) {
      const message = 'New passwords do not match';
      setPasswordFeedback({ type: 'error', message });
      toast.error(message);
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
        credentials: 'include',
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        const message = data.message ?? 'Failed to reset password';
        setPasswordFeedback({ type: 'error', message });
        toast.error(message);
        return;
      }
      const message = 'Password updated successfully';
      setPasswordFeedback({ type: 'success', message });
      toast.success(message);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      const message = 'Failed to reset password';
      setPasswordFeedback({ type: 'error', message });
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-8 text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Empty className="border bg-card">
        <EmptyHeader>
          <EmptyDescription>Could not load profile. Please try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/select-location';
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-6">
      <Card className="rounded-2xl bg-linear-to-r from-secondary/45 via-card to-card py-5">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your account and password</p>
          </div>
          <Button variant="outline" onClick={handleBack} className="w-fit shrink-0">
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Update your name and avatar (image URL only)</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex min-w-32 flex-col items-center gap-2">
                  <AvatarImageWithFallback
                    src={profileForm.avatar || user.avatar}
                    name={profileForm.name || user.name}
                    className="size-24"
                  />
                  <span className="text-xs text-muted-foreground">Avatar preview</span>
                </div>
                <FieldGroup className="flex-1 gap-4">
                  <Field className="gap-2">
                    <FieldLabel htmlFor="profile-name">Name</FieldLabel>
                    <Input
                      id="profile-name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Your name"
                    />
                  </Field>
                  <Field className="gap-2">
                    <FieldLabel>Avatar image URL</FieldLabel>
                    {profileForm.avatar ? (
                      <div className="flex items-center gap-2">
                        <Input value={profileForm.avatar} readOnly className="bg-muted" />
                        <Button type="button" variant="outline" size="icon" onClick={handleClearAvatar} title="Remove avatar">
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Paste image URL..."
                          value={newAvatarUrl}
                          onChange={(e) => setNewAvatarUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAvatarUrl();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleAddAvatarUrl}
                          disabled={!newAvatarUrl.trim()}
                          title="Add avatar URL"
                        >
                          <Plus />
                        </Button>
                      </div>
                    )}
                    <FieldDescription className="text-xs">Add an image URL for your avatar.</FieldDescription>
                  </Field>
                </FieldGroup>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProfile} disabled={profileSaving}>
                  {profileSaving ? <Spinner /> : 'Save profile'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reset password</CardTitle>
              <CardDescription>Change your password using your current password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResetPassword} className="grid gap-4 md:grid-cols-2">
                <Field className="gap-2 md:col-span-2">
                  <FieldLabel htmlFor="old-password">Current password</FieldLabel>
                  <Input
                    id="old-password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.oldPassword}
                    onChange={(e) => {
                      setPasswordForm((p) => ({ ...p, oldPassword: e.target.value }));
                      setPasswordFeedback(null);
                    }}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                  />
                </Field>
                <Field className="gap-2">
                  <FieldLabel htmlFor="new-password">New password</FieldLabel>
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => {
                      setPasswordForm((p) => ({ ...p, newPassword: e.target.value }));
                      setPasswordFeedback(null);
                    }}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                </Field>
                <Field className="gap-2">
                  <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => {
                      setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }));
                      setPasswordFeedback(null);
                    }}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                  />
                </Field>
                {passwordFeedback && (
                  <Alert
                    role={passwordFeedback.type === 'error' ? 'alert' : 'status'}
                    variant={passwordFeedback.type === 'error' ? 'destructive' : 'default'}
                    className="md:col-span-2"
                  >
                    {passwordFeedback.type === 'error' ? <AlertTriangle /> : <CheckCircle2 />}
                    <AlertDescription>{passwordFeedback.message}</AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-2 md:col-span-2">
                  <Button type="submit" disabled={passwordSaving}>
                    {passwordSaving ? <Spinner /> : 'Update password'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((s) => !s)}
                  >
                    {showPassword ? 'Hide' : 'Show'} passwords
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Account info</CardTitle>
              <CardDescription>Read-only details</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
                <AvatarImageWithFallback
                  src={profileForm.avatar || user.avatar}
                  name={profileForm.name || user.name}
                  className="size-12"
                />
                <div className="min-w-0">
                  <p className="truncate font-medium">{profileForm.name || user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-md border bg-card p-3">
                <p>
                  <span className="text-muted-foreground">Role:</span> {user.role}
                </p>
                <p>
                  <span className="text-muted-foreground">Email:</span> {user.email}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

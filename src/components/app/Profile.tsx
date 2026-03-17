import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Plus, X } from 'lucide-react';
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
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (!src?.trim() || failed) {
    return (
      <Avatar className={className}>
        <AvatarFallback className="bg-emerald-100 text-emerald-900">{initials}</AvatarFallback>
      </Avatar>
    );
  }
  return (
    <Avatar className={className}>
      <AvatarImage src={src} alt="" onError={() => setFailed(true)} />
      <AvatarFallback className="bg-emerald-100 text-emerald-900">{initials}</AvatarFallback>
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        Could not load profile. Please try again.
      </div>
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
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">Manage your account and password</p>
        </div>
        <Button variant="outline" onClick={handleBack} className="w-fit shrink-0">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your name and avatar (image URL only)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2">
              <AvatarImageWithFallback
                src={profileForm.avatar || user.avatar}
                name={profileForm.name || user.name}
                className="h-24 w-24"
              />
              <span className="text-xs text-muted-foreground">Avatar preview</span>
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="profile-name">Name</Label>
                <Input
                  id="profile-name"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label>Avatar image URL</Label>
                {profileForm.avatar ? (
                  <div className="flex items-center gap-2">
                    <Input value={profileForm.avatar} readOnly className="bg-muted" />
                    <Button type="button" variant="outline" size="icon" onClick={handleClearAvatar} title="Remove avatar">
                      <X className="h-4 w-4" />
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
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Add an image URL for your avatar. Same as product images.</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveProfile} disabled={profileSaving}>
              {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save profile'}
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
          <form onSubmit={handleResetPassword} className="space-y-4 max-w-sm">
            <div className="space-y-2">
              <Label htmlFor="old-password">Current password</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
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
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
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
            </div>
            {passwordFeedback && (
              <div
                role={passwordFeedback.type === 'error' ? 'alert' : 'status'}
                className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium ${
                  passwordFeedback.type === 'error'
                    ? 'border-red-300 bg-red-50 text-red-800'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {passwordFeedback.type === 'error' ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{passwordFeedback.message}</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={passwordSaving}>
                {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
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

      <Card>
        <CardHeader>
          <CardTitle>Account info</CardTitle>
          <CardDescription>Read-only details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Email:</span> {user.email}
          </p>
          <p>
            <span className="text-muted-foreground">Role:</span> {user.role}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

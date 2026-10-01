import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import { AlertCircle, Dices, Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  roles?: string[];
  createdAt: string;
}

const ROLE_ORDER = ['admin', 'store_manager', 'customer'] as const;

function rolesOf(user: User): string[] {
  const granted = new Set([user.role, ...(user.roles ?? [])]);
  return ROLE_ORDER.filter((r) => granted.has(r));
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
}

const EMPTY_FORM: UserFormData = { name: '', email: '', password: '', role: '' };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  store_manager: 'Store Manager',
  customer: 'Customer',
};

const ROLE_VARIANTS: Record<string, React.ComponentProps<typeof Badge>['variant']> = {
  admin: 'default',
  store_manager: 'info',
  customer: 'secondary',
};

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generatePassword(length = 12): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => PASSWORD_ALPHABET[n % PASSWORD_ALPHABET.length]).join('');
}

export function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: string; roles: string[] }>({
    name: '',
    role: '',
    roles: [],
  });
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordUser, setPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError('');
    setDialogOpen(true);
  };

  const openDelete = (user: User) => {
    setDeletingUser(user);
    setError('');
    setDeleteDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({ name: user.name, role: user.role, roles: rolesOf(user) });
    setError('');
    setEditDialogOpen(true);
  };

  const toggleEditRole = (value: string, checked: boolean) => {
    setEditForm((prev) => {
      const roles = ROLE_ORDER.filter((r) => (r === value ? checked : prev.roles.includes(r)));
      const role = roles.includes(prev.role as (typeof ROLE_ORDER)[number]) ? prev.role : (roles[0] ?? '');
      return { ...prev, roles, role };
    });
  };

  const openPasswordReset = (user: User) => {
    setPasswordUser(user);
    setNewPassword('');
    setShowNewPassword(false);
    setError('');
    setPasswordDialogOpen(true);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${passwordUser._id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        const msg = data.message ?? 'Failed to reset password';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Password updated');
      setPasswordDialogOpen(false);
      setPasswordUser(null);
      setNewPassword('');
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateEditField = (field: 'name' | 'role', value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/users/${editingUser._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          role: editForm.role,
          roles: editForm.roles,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Failed to update user';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('User updated');
      setEditDialogOpen(false);
      setEditingUser(null);
      await fetchUsers();
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Something went wrong';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success('User created');
      setDialogOpen(false);
      await fetchUsers();
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deletingUser._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Failed to delete';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('User deleted');
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      await fetchUsers();
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof UserFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const filteredAndSortedUsers = (() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? users.filter(
          (u) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        )
      : users;
    return [...filtered].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  })();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage users and their roles. Assign managers to stores via the Stores page.
          </p>
        </div>
        <Button onClick={openCreate} disabled={loading}>
          <Plus data-icon="inline-start" />
          Add User
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="pl-9 max-w-sm"
          disabled={loading}
        />
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
        <div className="data-table-scroll-wrapper flex-1 min-h-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-44" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Skeleton className="size-7 rounded-md" />
                        <Skeleton className="size-7 rounded-md" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8">
                    <Empty className="md:p-6">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Users />
                        </EmptyMedia>
                        <EmptyTitle>
                          {users.length === 0 ? 'No users found.' : 'No users match your search.'}
                        </EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </td>
                </tr>
              ) : (
                filteredAndSortedUsers
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map((user) => (
                <tr key={user._id}>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {rolesOf(user).map((r) => (
                        <Badge key={r} variant={ROLE_VARIANTS[r] ?? 'outline'}>
                          {ROLE_LABELS[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(user)}
                        title="Edit name and roles"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openPasswordReset(user)}
                        title="Reset password"
                        aria-label={`Reset password for ${user.name}`}
                      >
                        <KeyRound />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDelete(user)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
        {filteredAndSortedUsers.length > 0 && (
          <TablePagination
            currentPage={page}
            totalItems={filteredAndSortedUsers.length}
            onPageChange={setPage}
            label="users"
          />
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="user-name">Name</FieldLabel>
                <Input
                  id="user-name"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="user-email">Email</FieldLabel>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="user@example.com"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  required
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="user-password">Password</FieldLabel>
                <Input
                  id="user-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  required
                  minLength={6}
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="user-role">Role</FieldLabel>
                <Select value={form.role} onValueChange={(v) => updateField('role', v)}>
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="store_manager">Store Manager</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <><Spinner data-icon="inline-start" />Creating...</>
                  ) : (
                    'Create User'
                  )}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditingUser(null); setError(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update name and roles for {editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="edit-user-name">Name</FieldLabel>
                <Input
                  id="edit-user-name"
                  placeholder="Full name"
                  value={editForm.name}
                  onChange={(e) => updateEditField('name', e.target.value)}
                  required
                />
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">Roles</legend>
                <p className="text-xs text-muted-foreground">
                  An account with more than one role can switch views from the top bar.
                </p>
                {ROLE_ORDER.map((r) => (
                  <label key={r} htmlFor={`edit-role-${r}`} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`edit-role-${r}`}
                      checked={editForm.roles.includes(r)}
                      onCheckedChange={(checked) => toggleEditRole(r, checked === true)}
                    />
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </fieldset>
              <Field className="gap-2">
                <FieldLabel htmlFor="edit-user-role">Default view</FieldLabel>
                <Select
                  value={editForm.role}
                  onValueChange={(v) => updateEditField('role', v)}
                  disabled={editForm.roles.length === 0}
                >
                  <SelectTrigger id="edit-user-role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {editForm.roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || editForm.roles.length === 0}>
                  {submitting ? (
                    <><Spinner data-icon="inline-start" />Saving...</>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) {
            setPasswordUser(null);
            setNewPassword('');
            setError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordUser?.name} ({passwordUser?.email}). Share it with them privately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="reset-user-password">New password</FieldLabel>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="reset-user-password"
                      name="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      spellCheck={false}
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      maxLength={128}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {showNewPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setNewPassword(generatePassword());
                      setShowNewPassword(true);
                    }}
                  >
                    <Dices data-icon="inline-start" />
                    Generate
                  </Button>
                </div>
              </Field>
              {error && (
                <Alert variant="destructive" role="alert">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || newPassword.length < 6}>
                  {submitting ? (
                    <><Spinner data-icon="inline-start" />Updating…</>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.name}</strong> (
              {deletingUser?.email})? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {submitting ? (
                <><Spinner data-icon="inline-start" />Deleting...</>
              ) : (
                'Delete User'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

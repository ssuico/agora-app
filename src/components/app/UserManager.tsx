import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
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

const ROLE_COLORS: Record<string, string> = {
  admin: 'border border-primary/35 bg-primary/10 text-primary',
  store_manager: 'border border-accent/40 bg-accent/10 text-accent',
  customer: 'border border-secondary/60 bg-secondary/35 text-foreground',
};

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
  const [editForm, setEditForm] = useState<{ name: string; role: string }>({ name: '', role: '' });
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
    setEditForm({ name: user.name, role: user.role });
    setError('');
    setEditDialogOpen(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading users...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage users and their roles. Assign managers to stores via the Stores page.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Add User
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="pl-9 max-w-sm"
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
              {filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {users.length === 0 ? 'No users found.' : 'No users match your search.'}
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
                    <Badge
                      variant="outline"
                      className={`text-xs ${ROLE_COLORS[user.role] ?? ''}`}
                    >
                      {ROLE_LABELS[user.role] ?? user.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(user)}
                        title="Edit name and role"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDelete(user)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Password</Label>
              <Input
                id="user-password"
                type="password"
                placeholder="Min 6 characters"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => updateField('role', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="store_manager">Store Manager</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditingUser(null); setError(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update name and role for {editingUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-user-name">Name</Label>
              <Input
                id="edit-user-name"
                placeholder="Full name"
                value={editForm.name}
                onChange={(e) => updateEditField('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editForm.role} onValueChange={(v) => updateEditField('role', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="store_manager">Store Manager</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.name}</strong> (
              {deletingUser?.email})? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

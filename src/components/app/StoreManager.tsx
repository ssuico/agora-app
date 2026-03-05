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
import { Pencil, Plus, Trash2, UserPlus, UserMinus } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Location {
  _id: string;
  name: string;
}

interface Store {
  _id: string;
  name: string;
  locationId: Location | string;
  createdAt: string;
}

interface StoreFormData {
  name: string;
  locationId: string;
}

interface ManagerUser {
  _id: string;
  name: string;
  email: string;
}

interface Assignment {
  _id: string;
  userId: ManagerUser;
  storeId: string;
}

const EMPTY_FORM: StoreFormData = { name: '', locationId: '' };

function getLocationName(loc: Location | string): string {
  if (typeof loc === 'object' && loc !== null) return loc.name;
  return String(loc);
}

function getLocationId(loc: Location | string): string {
  if (typeof loc === 'object' && loc !== null) return loc._id;
  return String(loc);
}

export function StoreManager() {
  const [stores, setStores] = useState<Store[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [managerDialogOpen, setManagerDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deletingStore, setDeletingStore] = useState<Store | null>(null);
  const [managingStore, setManagingStore] = useState<Store | null>(null);
  const [form, setForm] = useState<StoreFormData>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [managers, setManagers] = useState<Assignment[]>([]);
  const [availableManagers, setAvailableManagers] = useState<ManagerUser[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const fetchStores = async () => {
    try {
      const res = await fetch('/api/stores');
      if (res.ok) setStores(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations');
      if (res.ok) setLocations(await res.json());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchStores();
    fetchLocations();
  }, []);

  const openCreate = () => {
    setEditingStore(null);
    setForm(EMPTY_FORM);
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (store: Store) => {
    setEditingStore(store);
    setForm({
      name: store.name,
      locationId: getLocationId(store.locationId),
    });
    setError('');
    setDialogOpen(true);
  };

  const openDelete = (store: Store) => {
    setDeletingStore(store);
    setError('');
    setDeleteDialogOpen(true);
  };

  const openManagers = async (store: Store) => {
    setManagingStore(store);
    setError('');
    setSelectedManagerId('');
    setManagerDialogOpen(true);
    try {
      const [mgrRes, usersRes] = await Promise.all([
        fetch(`/api/stores/${store._id}/managers`),
        fetch('/api/users?role=store_manager'),
      ]);
      if (mgrRes.ok) setManagers(await mgrRes.json());
      if (usersRes.ok) setAvailableManagers(await usersRes.json());
    } catch {
      /* ignore */
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      name: form.name.trim(),
      locationId: form.locationId,
    };

    try {
      const url = editingStore ? `/api/stores/${editingStore._id}` : '/api/stores';
      const method = editingStore ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Something went wrong';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success(editingStore ? 'Store updated' : 'Store created');
      setDialogOpen(false);
      await fetchStores();
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingStore) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/stores/${deletingStore._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Failed to delete';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Store deleted');
      setDeleteDialogOpen(false);
      setDeletingStore(null);
      await fetchStores();
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssign = async () => {
    if (!managingStore || !selectedManagerId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/stores/${managingStore._id}/assign-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedManagerId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Failed to assign';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Manager assigned');
      setSelectedManagerId('');
      await openManagers(managingStore);
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnassign = async (userId: string) => {
    if (!managingStore) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/stores/${managingStore._id}/unassign-manager`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Failed to unassign';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Manager unassigned');
      await openManagers(managingStore);
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof StoreFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const assignedManagerIds = new Set(
    managers.map((m) => (typeof m.userId === 'object' ? m.userId._id : m.userId))
  );
  const unassignedManagers = availableManagers.filter((u) => !assignedManagerIds.has(u._id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading stores...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
          <p className="text-sm text-muted-foreground">Manage stores and assign managers</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Add Store
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No stores found. Click "Add Store" to create one.
                </td>
              </tr>
            ) : (
              stores.map((store) => (
                <tr key={store._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{store.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {getLocationName(store.locationId)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(store.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openManagers(store)}>
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(store)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDelete(store)}
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStore ? 'Edit Store' : 'Add Store'}</DialogTitle>
            <DialogDescription>
              {editingStore
                ? 'Update the store details below.'
                : 'Fill in the details to create a new store.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="store-name">Name</Label>
              <Input
                id="store-name"
                placeholder="e.g. Main Branch"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={form.locationId} onValueChange={(v) => updateField('locationId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc._id} value={loc._id}>
                      {loc.name}
                    </SelectItem>
                  ))}
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
                {submitting ? 'Saving...' : editingStore ? 'Save Changes' : 'Create Store'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Store</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingStore?.name}</strong>? This action
              cannot be undone.
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
              {submitting ? 'Deleting...' : 'Delete Store'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manager Assignment Dialog */}
      <Dialog open={managerDialogOpen} onOpenChange={setManagerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Store Managers - {managingStore?.name}</DialogTitle>
            <DialogDescription>Assign or remove store managers for this store.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Managers</Label>
              {managers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No managers assigned yet.</p>
              ) : (
                <div className="space-y-2">
                  {managers.map((m) => {
                    const user = m.userId as ManagerUser;
                    return (
                      <div
                        key={m._id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleUnassign(user._id)}
                          disabled={submitting}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {unassignedManagers.length > 0 && (
              <div className="space-y-2">
                <Label>Assign Manager</Label>
                <div className="flex gap-2">
                  <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedManagers.map((u) => (
                        <SelectItem key={u._id} value={u._id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAssign} disabled={!selectedManagerId || submitting}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

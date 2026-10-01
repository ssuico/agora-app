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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import {
  AlertCircle,
  Pencil,
  Plus,
  Search,
  Store as StoreIcon,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
  isOpen?: boolean;
  isMaintenance?: boolean;
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
  const [page, setPage] = useState(1);
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
  const [managerSearch, setManagerSearch] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState<string | null>(null);

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
    setManagerSearch('');
    setSelectedToAdd(new Set());
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

  const handleBulkAssign = async () => {
    if (!managingStore || selectedToAdd.size === 0) return;
    setBulkAssigning(true);
    setError('');
    const ids = Array.from(selectedToAdd);
    const results = await Promise.allSettled(
      ids.map((userId) =>
        fetch(`/api/stores/${managingStore._id}/assign-manager`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) toast.error(`${failed} assignment(s) failed`);
    const succeeded = ids.length - failed;
    if (succeeded > 0) toast.success(`${succeeded} manager(s) assigned`);
    setSelectedToAdd(new Set());
    // Refresh lists
    const [mgrRes] = await Promise.all([fetch(`/api/stores/${managingStore._id}/managers`)]);
    if (mgrRes.ok) setManagers(await mgrRes.json());
    setBulkAssigning(false);
  };

  const handleUnassign = async (userId: string) => {
    if (!managingStore) return;
    setUnassigning(userId);
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
      toast.success('Manager removed');
      const mgrRes = await fetch(`/api/stores/${managingStore._id}/managers`);
      if (mgrRes.ok) setManagers(await mgrRes.json());
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setUnassigning(null);
    }
  };

  const handleToggleOpen = async (store: Store) => {
    const nextOpen = !(store.isOpen ?? true);
    setStores((prev) =>
      prev.map((s) => (s._id === store._id ? { ...s, isOpen: nextOpen } : s))
    );
    try {
      const res = await fetch(`/api/stores/${store._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: nextOpen }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to update');
        setStores((prev) =>
          prev.map((s) => (s._id === store._id ? { ...s, isOpen: store.isOpen } : s))
        );
        return;
      }
      toast.success(nextOpen ? 'Store is now open for customers' : 'Store is now closed for customers');
    } catch {
      toast.error('Network error');
      setStores((prev) =>
        prev.map((s) => (s._id === store._id ? { ...s, isOpen: store.isOpen } : s))
      );
    }
  };

  const handleToggleMaintenance = async (store: Store) => {
    const next = !(store.isMaintenance ?? false);
    setStores((prev) =>
      prev.map((s) => (s._id === store._id ? { ...s, isMaintenance: next } : s))
    );
    try {
      const res = await fetch(`/api/stores/${store._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMaintenance: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to update');
        setStores((prev) =>
          prev.map((s) => (s._id === store._id ? { ...s, isMaintenance: store.isMaintenance } : s))
        );
        return;
      }
      toast.success(next ? 'Maintenance mode enabled — store page is now unavailable' : 'Maintenance mode disabled — store page is accessible again');
    } catch {
      toast.error('Network error');
      setStores((prev) =>
        prev.map((s) => (s._id === store._id ? { ...s, isMaintenance: store.isMaintenance } : s))
      );
    }
  };

  const updateField = (field: keyof StoreFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const assignedManagerIds = useMemo(
    () => new Set(managers.map((m) => (typeof m.userId === 'object' ? m.userId._id : String(m.userId)))),
    [managers]
  );

  const filteredManagers = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    return availableManagers.filter(
      (u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [availableManagers, managerSearch]);

  const unassignedManagers = availableManagers.filter((u) => !assignedManagerIds.has(u._id));

  const allUnassignedVisible = filteredManagers.filter((u) => !assignedManagerIds.has(u._id));
  const allChecked =
    allUnassignedVisible.length > 0 &&
    allUnassignedVisible.every((u) => selectedToAdd.has(u._id));
  const someChecked = allUnassignedVisible.some((u) => selectedToAdd.has(u._id));

  const toggleSelectAll = () => {
    if (allChecked) {
      setSelectedToAdd(new Set());
    } else {
      setSelectedToAdd(new Set(allUnassignedVisible.map((u) => u._id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stores</h1>
          <p className="text-sm text-muted-foreground">Manage stores and assign managers</p>
        </div>
        <Button onClick={openCreate} disabled={loading}>
          <Plus data-icon="inline-start" />
          Add Store
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
        <div className="data-table-scroll-wrapper flex-1 min-h-0">
          <table className="data-table stores-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Location</th>
                <th>Created</th>
                <th>Open for customers</th>
                <th>Maintenance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Skeleton className="h-5 w-9 rounded-full" />
                        <Skeleton className="h-3.5 w-10" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Skeleton className="h-5 w-9 rounded-full" />
                        <Skeleton className="h-3.5 w-6" />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Skeleton className="size-7 rounded-md" />
                        <Skeleton className="size-7 rounded-md" />
                        <Skeleton className="size-7 rounded-md" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8">
                    <Empty className="md:p-6">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <StoreIcon />
                        </EmptyMedia>
                        <EmptyTitle>No stores found.</EmptyTitle>
                        <EmptyDescription>Click "Add Store" to create one.</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </td>
                </tr>
              ) : (
                stores
                  .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                  .map((store) => (
                <tr key={store._id}>
                  <td className="px-4 py-3 font-medium">{store.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {getLocationName(store.locationId)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(store.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={store.isOpen !== false}
                        onCheckedChange={() => handleToggleOpen(store)}
                        aria-label={`${store.isOpen !== false ? 'Open' : 'Closed'} for customers`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {store.isOpen !== false ? 'Open' : 'Closed'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={store.isMaintenance === true}
                        onCheckedChange={() => handleToggleMaintenance(store)}
                        aria-label={`Maintenance mode ${store.isMaintenance ? 'on' : 'off'}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {store.isMaintenance ? 'On' : 'Off'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openManagers(store)}>
                        <UserPlus />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(store)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDelete(store)}
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
        {stores.length > 0 && (
          <TablePagination
            currentPage={page}
            totalItems={stores.length}
            onPageChange={setPage}
            label="stores"
          />
        )}
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
          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-4">
              <Field className="gap-2">
                <FieldLabel htmlFor="store-name">Name</FieldLabel>
                <Input
                  id="store-name"
                  placeholder="e.g. Main Branch"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  required
                />
              </Field>
              <Field className="gap-2">
                <FieldLabel htmlFor="store-location">Location</FieldLabel>
                <Select value={form.locationId} onValueChange={(v) => updateField('locationId', v)}>
                  <SelectTrigger id="store-location">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {locations.map((loc) => (
                        <SelectItem key={loc._id} value={loc._id}>
                          {loc.name}
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
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <><Spinner data-icon="inline-start" />{editingStore ? 'Saving...' : 'Creating...'}</>
                  ) : (
                    editingStore ? 'Save Changes' : 'Create Store'
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
            <AlertDialogTitle>Delete Store</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingStore?.name}</strong>? This action
              cannot be undone.
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
                'Delete Store'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manager Assignment Dialog */}
      <Dialog open={managerDialogOpen} onOpenChange={(open) => { setManagerDialogOpen(open); if (!open) { setSelectedToAdd(new Set()); setManagerSearch(''); } }}>
        <DialogContent className="w-[85vw] max-w-none sm:max-w-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4" />
              Manage Store Managers
              {managingStore && <span className="text-muted-foreground font-normal">— {managingStore.name}</span>}
            </DialogTitle>
            <DialogDescription>
              Check one or more managers to assign them, or remove existing ones individually.
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or email..."
              value={managerSearch}
              onChange={(e) => setManagerSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[min(55vh,520px)] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted border-b border-border">
                  <tr>
                    <th className="w-10 px-3 py-2.5 text-center">
                      {/* select-all only applies to visible unassigned rows */}
                      <Checkbox
                        className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
                        checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        disabled={allUnassignedVisible.length === 0}
                        aria-label="Select all unassigned"
                        title={allChecked ? 'Deselect all' : 'Select all unassigned'}
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2.5 text-center font-medium text-muted-foreground w-28">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredManagers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8">
                        <Empty className="md:p-6">
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <Users />
                            </EmptyMedia>
                            {availableManagers.length === 0 ? (
                              <>
                                <EmptyTitle>No store managers found.</EmptyTitle>
                                <EmptyDescription>Create manager accounts first.</EmptyDescription>
                              </>
                            ) : (
                              <EmptyTitle>No managers match your search.</EmptyTitle>
                            )}
                          </EmptyHeader>
                        </Empty>
                      </td>
                    </tr>
                  ) : (
                    filteredManagers.map((u) => {
                      const isAssigned = assignedManagerIds.has(u._id);
                      const isChecked = selectedToAdd.has(u._id);
                      const isUnassigning = unassigning === u._id;
                      return (
                        <tr
                          key={u._id}
                          className={`border-b border-border/60 last:border-0 transition-colors ${
                            isAssigned
                              ? 'bg-primary-subtle/30'
                              : isChecked
                              ? 'bg-accent/30'
                              : 'hover:bg-muted/40'
                          }`}
                          onClick={() => { if (!isAssigned) toggleSelect(u._id); }}
                          style={{ cursor: isAssigned ? 'default' : 'pointer' }}
                        >
                          <td className="w-10 px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            {isAssigned ? (
                              <span className="inline-flex size-4 items-center justify-center rounded bg-primary text-primary-foreground" title="Already assigned">
                                <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-5"/></svg>
                              </span>
                            ) : (
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleSelect(u._id)}
                                aria-label={`Select ${u.name}`}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-medium">{u.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-2.5 text-center">
                            {isAssigned ? (
                              <Badge variant="default">Assigned</Badge>
                            ) : (
                              <Badge variant="outline">Unassigned</Badge>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            {isAssigned && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleUnassign(u._id)}
                                disabled={isUnassigning || bulkAssigning}
                                title="Remove from store"
                              >
                                {isUnassigning
                                  ? <Spinner />
                                  : <UserMinus />
                                }
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="items-center gap-2">
            <p className="text-sm text-muted-foreground mr-auto">
              {managers.length} assigned · {unassignedManagers.length} unassigned
              {selectedToAdd.size > 0 && (
                <span className="ml-2 font-medium text-foreground">· {selectedToAdd.size} selected</span>
              )}
            </p>
            <Button variant="outline" onClick={() => setManagerDialogOpen(false)}>Close</Button>
            <Button
              onClick={handleBulkAssign}
              disabled={selectedToAdd.size === 0 || bulkAssigning}
            >
              {bulkAssigning
                ? <><Spinner data-icon="inline-start" />Assigning...</>
                : <><UserPlus data-icon="inline-start" />Assign Selected ({selectedToAdd.size})</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

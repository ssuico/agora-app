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
import { ChevronLeft, ChevronRight, ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Store {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  isPerishable: boolean;
  storeId: string;
  createdAt: string;
}

interface DailyRow {
  _id: string;
  productId: string;
  productName: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  isPerishable: boolean;
  initialStock: number;
  restock: number;
  carryOverStock: number;
  sold: number;
  currentStock: number;
  date: string;
}

interface ProductFormData {
  storeId: string;
  name: string;
  images: string[];
  costPrice: string;
  sellingPrice: string;
  stockQuantity: string;
  isPerishable: boolean;
}

interface ProductManagerProps {
  storeId?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ProductImage({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded ${className}`}>
        <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`object-cover rounded ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

function StockBadge({ value }: { value: number }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        value === 0
          ? 'bg-red-100 text-red-700'
          : value < 10
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-green-100 text-green-700'
      }`}
    >
      {value}
    </span>
  );
}

export function ProductManager({ storeId: fixedStoreId }: ProductManagerProps) {
  const isScoped = !!fixedStoreId;
  const todayStr = toLocalDateStr(new Date());

  const emptyForm: ProductFormData = {
    storeId: fixedStoreId ?? '',
    name: '',
    images: [],
    costPrice: '',
    sellingPrice: '',
    stockQuantity: '',
    isPerishable: false,
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStoreId, setFilterStoreId] = useState<string>(fixedStoreId ?? 'all');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(emptyForm);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [restockQty, setRestockQty] = useState('');

  const isEditable = selectedDate >= todayStr;
  const storeMap = new Map(stores.map((s) => [s._id, s.name]));
  const effectiveStoreId = fixedStoreId ?? (filterStoreId !== 'all' ? filterStoreId : undefined);

  const fetchStores = async () => {
    if (isScoped) return;
    try {
      const res = await fetch('/api/stores');
      if (res.ok) setStores(await res.json());
    } catch { /* ignore */ }
  };

  const fetchProducts = async (sid?: string) => {
    try {
      const eid = sid ?? fixedStoreId;
      const query = eid && eid !== 'all' ? `?storeId=${eid}` : '';
      const res = await fetch(`/api/products${query}`);
      if (res.ok) setProducts(await res.json());
    } catch { /* ignore */ }
  };

  const fetchDailyInventory = async (date: string, sid?: string) => {
    const eid = sid ?? effectiveStoreId;
    if (!eid) {
      setDailyRows([]);
      return;
    }
    try {
      const params = new URLSearchParams({ storeId: eid, date });
      const res = await fetch(`/api/inventory/daily?${params}`);
      if (res.ok) setDailyRows(await res.json());
    } catch { /* ignore */ }
  };

  const refreshData = async (sid?: string) => {
    setLoading(true);
    await fetchProducts(sid);
    await fetchDailyInventory(selectedDate, sid);
    setLoading(false);
  };

  useEffect(() => {
    fetchStores();
    refreshData(filterStoreId);
  }, []);

  useEffect(() => {
    if (!isScoped) refreshData(filterStoreId);
  }, [filterStoreId]);

  useEffect(() => {
    fetchDailyInventory(selectedDate);
  }, [selectedDate]);

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(toLocalDateStr(d));
  };

  // --- Product CRUD helpers ---

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setRestockQty('');
    setNewImageUrl('');
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setForm({
      storeId: fixedStoreId ?? product.storeId,
      name: product.name,
      images: product.images ?? [],
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      stockQuantity: String(product.stockQuantity),
      isPerishable: product.isPerishable ?? false,
    });
    setRestockQty('');
    setNewImageUrl('');
    setError('');
    setDialogOpen(true);
  };

  const openDelete = (product: Product) => {
    setDeletingProduct(product);
    setError('');
    setDeleteDialogOpen(true);
  };

  const addImage = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setForm((prev) => ({ ...prev, images: [...prev.images, url] }));
    setNewImageUrl('');
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingProduct) {
        const productPayload = {
          storeId: form.storeId,
          name: form.name.trim(),
          images: form.images,
          costPrice: parseFloat(form.costPrice) || 0,
          sellingPrice: parseFloat(form.sellingPrice) || 0,
          isPerishable: form.isPerishable,
        };

        const res = await fetch(`/api/products/${editingProduct._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productPayload),
        });

        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          setError(data.message ?? 'Something went wrong');
          return;
        }

        const qty = parseInt(restockQty, 10);
        if (qty > 0) {
          const restockRes = await fetch(`/api/inventory/restock/${editingProduct._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: qty, storeId: form.storeId, date: selectedDate }),
          });
          if (!restockRes.ok) {
            const data = (await restockRes.json()) as { message?: string };
            setError(data.message ?? 'Restock failed');
            return;
          }
        }
      } else {
        const payload = {
          storeId: form.storeId,
          name: form.name.trim(),
          images: form.images,
          costPrice: parseFloat(form.costPrice) || 0,
          sellingPrice: parseFloat(form.sellingPrice) || 0,
          stockQuantity: parseInt(form.stockQuantity, 10) || 0,
          isPerishable: form.isPerishable,
        };

        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          setError(data.message ?? 'Something went wrong');
          return;
        }
      }

      setDialogOpen(false);
      await refreshData(filterStoreId);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingProduct) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/products/${deletingProduct._id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Failed to delete product');
        return;
      }
      setDeleteDialogOpen(false);
      setDeletingProduct(null);
      await refreshData(filterStoreId);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof ProductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Build display rows from daily data + product fallback ---

  const dailyMap = new Map(dailyRows.map((r) => [r.productId, r]));

  const displayRows = products.map((product) => {
    const daily = dailyMap.get(product._id);
    return {
      product,
      initialStock: daily?.initialStock ?? 0,
      restock: daily?.restock ?? 0,
      carryOverStock: daily?.carryOverStock ?? 0,
      sold: daily?.sold ?? 0,
      currentStock: daily?.currentStock ?? product.stockQuantity,
    };
  });

  // --- Render ---

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground">Manage your product catalog and inventory</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog and inventory</p>
        </div>
        {isEditable && (
          <Button onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" />Add Product
          </Button>
        )}
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {!isScoped && stores.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Store:</Label>
            <Select value={filterStoreId} onValueChange={setFilterStoreId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All Stores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stores</SelectItem>
                {stores.map((store) => (
                  <SelectItem key={store._id} value={store._id}>{store.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date picker */}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)} title="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            className="w-40 text-center"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <Button variant="ghost" size="sm" onClick={() => shiftDate(1)} title="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {selectedDate !== todayStr && (
            <Button variant="outline" size="sm" className="ml-1 text-xs" onClick={() => setSelectedDate(todayStr)}>
              Today
            </Button>
          )}
        </div>
      </div>

      {selectedDate < todayStr && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Viewing inventory for <strong>{selectedDate}</strong> (read-only). Switch to today or a future date to make changes.
        </div>
      )}
      {selectedDate > todayStr && (
        <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Viewing future date <strong>{selectedDate}</strong> (test mode). Inventory records will be auto-initialized from the last known data.
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground w-16">Image</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              {!isScoped && (
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Store</th>
              )}
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cost</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Selling</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Initial</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Restock</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Carry-over</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Sold</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Current</th>
              {isEditable && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={isScoped ? (isEditable ? 11 : 10) : (isEditable ? 12 : 11)}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No products found. {isEditable ? 'Click "Add Product" to create one.' : ''}
                </td>
              </tr>
            ) : (
              displayRows.map(({ product, initialStock, restock, carryOverStock, sold, currentStock }) => (
                <tr key={product._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-2">
                    <ProductImage src={product.images?.[0]} className="h-10 w-10" />
                  </td>
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${product.isPerishable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                      {product.isPerishable ? 'Perishable' : 'Non-perishable'}
                    </span>
                  </td>
                  {!isScoped && (
                    <td className="px-4 py-3 text-muted-foreground">{storeMap.get(product.storeId) ?? '-'}</td>
                  )}
                  <td className="px-4 py-3">{fmt(product.costPrice)}</td>
                  <td className="px-4 py-3">{fmt(product.sellingPrice)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{initialStock}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {restock > 0 ? (
                      <span className="text-blue-600 font-medium">+{restock}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{carryOverStock}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {sold > 0 ? (
                      <span className="text-orange-600 font-medium">{sold}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StockBadge value={currentStock} />
                  </td>
                  {isEditable && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(product)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => openDelete(product)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
            <DialogDescription>
              {editingProduct
                ? 'Update details and optionally add restock quantity.'
                : 'Fill in the details to add a new product.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isScoped && (
              <div className="space-y-2">
                <Label htmlFor="product-store">Store</Label>
                <Select value={form.storeId} onValueChange={(val) => updateField('storeId', val)}>
                  <SelectTrigger id="product-store" className="w-full"><SelectValue placeholder="Select a store" /></SelectTrigger>
                  <SelectContent>
                    {stores.map((store) => (
                      <SelectItem key={store._id} value={store._id}>{store.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                placeholder="e.g. Rice (25kg)"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Product Type</Label>
              <Select
                value={form.isPerishable ? 'perishable' : 'non-perishable'}
                onValueChange={(val) => setForm((prev) => ({ ...prev, isPerishable: val === 'perishable' }))}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="non-perishable">Non-perishable</SelectItem>
                  <SelectItem value="perishable">Perishable</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Perishable products will not carry over remaining stock to the next day.
              </p>
            </div>

            {/* Images */}
            <div className="space-y-2">
              <Label>Product Images</Label>
              {form.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="relative group">
                      <ProductImage src={url} className="h-16 w-16 border" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute -right-1.5 -top-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Paste image URL..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); addImage(); }
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addImage} disabled={!newImageUrl.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Add image URLs one at a time. The first image will be used as the thumbnail.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-cost">Cost Price (PHP)</Label>
                <Input
                  id="product-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.costPrice}
                  onChange={(e) => updateField('costPrice', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-selling">Selling Price (PHP)</Label>
                <Input
                  id="product-selling"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.sellingPrice}
                  onChange={(e) => updateField('sellingPrice', e.target.value)}
                  required
                />
              </div>
            </div>

            {editingProduct ? (
              <div className="space-y-2">
                <Label htmlFor="product-restock">Restock Quantity</Label>
                <Input
                  id="product-restock"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the number of units to add to current stock. Leave at 0 if no restock.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="product-stock">Initial Stock Quantity</Label>
                <Input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={form.stockQuantity}
                  onChange={(e) => updateField('stockQuantity', e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The starting inventory count for this product.
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !form.storeId}>
                {submitting ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingProduct?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? 'Deleting...' : 'Delete Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

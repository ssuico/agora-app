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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, ChevronLeft, ChevronRight, ImageIcon, Info, Lock, LockOpen, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

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
  sold: number;
  displayInitialStock: number;
  currentStock: number;
  date: string;
}

interface StoreClosingData {
  _id: string;
  storeId: string;
  date: string;
  closedAt: string;
  carryOverSelections: Array<{
    productId: string;
    carryOver: boolean;
    currentStock: number;
  }>;
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

interface InvReportProduct {
  productId: string;
  productName: string;
  isPerishable: boolean;
  costPrice: number;
  sellingPrice: number;
  initialStock: number;
  restock: number;
  displayInitialStock: number;
  sold: number;
  currentStock: number;
}

interface InventoryReportData {
  date: string;
  products: InvReportProduct[];
}

interface ProductManagerProps {
  storeId?: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const APP_TIMEZONE = 'America/New_York';

function toLocalDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
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

function ProductManagerInventoryReport({
  storeId,
  invDate,
  invData,
  invLoading,
  invError,
  onInvDateChange,
  onFetch,
}: {
  storeId: string | undefined;
  invDate: string;
  invData: InventoryReportData | null;
  invLoading: boolean;
  invError: string;
  onInvDateChange: (d: string) => void;
  onFetch: () => void;
}) {
  if (!storeId) {
    return (
      <p className="rounded-lg border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Select a store above to view the inventory report.
      </p>
    );
  }

  const totals = invData
    ? invData.products.reduce(
        (acc, p) => ({
          initialStock: acc.initialStock + p.displayInitialStock,
          restock: acc.restock + p.restock,
          sold: acc.sold + p.sold,
          currentStock: acc.currentStock + p.currentStock,
        }),
        { initialStock: 0, restock: 0, sold: 0, currentStock: 0 }
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={invDate} onChange={(e) => onInvDateChange(e.target.value)} className="w-40" />
        </div>
        <Button onClick={onFetch} disabled={invLoading}>{invLoading ? 'Loading...' : 'Generate Report'}</Button>
      </div>

      {invError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{invError}</div>
      )}

      {!invLoading && invData && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <div className="border-b px-4 py-3">
            <h3 className="text-sm font-semibold">Inventory Report — {invData.date}</h3>
          </div>
          {invData.products.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No inventory records for this date.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cost</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Selling</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Initial</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Restock</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Sold</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Current</th>
                </tr>
              </thead>
              <tbody>
                {invData.products.map((p) => (
                  <tr key={p.productId} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5 font-medium">{p.productName}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.isPerishable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                        {p.isPerishable ? 'Perishable' : 'Non-perishable'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{fmt(p.costPrice)}</td>
                    <td className="px-4 py-2.5">{fmt(p.sellingPrice)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.displayInitialStock}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.restock > 0 ? <span className="text-blue-600 font-medium">+{p.restock}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.sold > 0 ? <span className="text-orange-600 font-medium">{p.sold}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right"><StockBadge value={p.currentStock} /></td>
                  </tr>
                ))}
                {totals && (
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5" />
                    <td className="px-4 py-2.5 text-right tabular-nums">{totals.initialStock}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-blue-600">+{totals.restock}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-orange-600">{totals.sold}</td>
                    <td className="px-4 py-2.5 text-right"><StockBadge value={totals.currentStock} /></td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!invLoading && !invData && !invError && (
        <p className="py-8 text-center text-muted-foreground">Select a date and click &quot;Generate Report&quot; to view inventory data.</p>
      )}
    </div>
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

  type MainTab = 'products' | 'inventory-report';
  const [mainTab, setMainTab] = useState<MainTab>('products');
  const [invDate, setInvDate] = useState(todayStr);
  const [invData, setInvData] = useState<InventoryReportData | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');

  // Store closing state
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingStatus, setClosingStatus] = useState<StoreClosingData | null>(null);
  const [closeSelections, setCloseSelections] = useState<Map<string, boolean>>(new Map());
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);

  const isEditable = selectedDate === todayStr;
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

  const fetchClosingStatus = async (date: string, sid?: string) => {
    const eid = sid ?? effectiveStoreId;
    if (!eid) {
      setClosingStatus(null);
      return;
    }
    try {
      const params = new URLSearchParams({ storeId: eid, date });
      const res = await fetch(`/api/inventory/close-status?${params}`);
      if (res.ok) {
        const data = await res.json();
        setClosingStatus(data);
      } else {
        setClosingStatus(null);
      }
    } catch {
      setClosingStatus(null);
    }
  };

  const refreshData = async (sid?: string, date?: string) => {
    const d = date ?? selectedDate;
    setLoading(true);
    await fetchProducts(sid);
    await Promise.all([
      fetchDailyInventory(d, sid),
      fetchClosingStatus(d, sid),
    ]);
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
    fetchClosingStatus(selectedDate);
  }, [selectedDate]);

  const shiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const fetchInventoryReport = async () => {
    if (!effectiveStoreId) return;
    setInvLoading(true);
    setInvError('');
    try {
      const params = new URLSearchParams({ storeId: effectiveStoreId, date: invDate });
      const res = await fetch(`/api/reports/inventory?${params}`);
      if (!res.ok) throw new Error('Failed to load inventory report');
      setInvData(await res.json());
    } catch (e) {
      setInvError(e instanceof Error ? e.message : 'Error');
    } finally {
      setInvLoading(false);
    }
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
          const msg = data.message ?? 'Something went wrong';
          setError(msg);
          toast.error(msg);
          return;
        }

        const qty = parseInt(restockQty, 10);
        if (qty > 0) {
          const restockRes = await fetch(`/api/inventory/restock/${editingProduct._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: qty, storeId: form.storeId, date: todayStr }),
          });
          if (!restockRes.ok) {
            const data = (await restockRes.json()) as { message?: string };
            const msg = data.message ?? 'Restock failed';
            setError(msg);
            toast.error(msg);
            return;
          }
          toast.success('Product updated and restocked');
        } else {
          toast.success('Product updated');
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
          const msg = data.message ?? 'Something went wrong';
          setError(msg);
          toast.error(msg);
          return;
        }
        toast.success('Product created');
      }

      setDialogOpen(false);
      await refreshData(filterStoreId);
    } catch {
      setError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
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
        const msg = data.message ?? 'Failed to delete product';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Product deleted');
      setDeleteDialogOpen(false);
      setDeletingProduct(null);
      await refreshData(filterStoreId);
    } catch {
      setError('Network error. Please try again.');
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCloseStore = () => {
    const dailyProductIds = new Set(dailyRows.map((r) => r.productId));
    const defaults = new Map<string, boolean>();
    if (closingStatus) {
      for (const sel of closingStatus.carryOverSelections) {
        if (dailyProductIds.has(sel.productId)) {
          defaults.set(sel.productId, sel.carryOver);
        }
      }
    }
    for (const product of products) {
      if (dailyProductIds.has(product._id) && !defaults.has(product._id)) {
        defaults.set(product._id, !product.isPerishable);
      }
    }
    setCloseSelections(defaults);
    setCloseDialogOpen(true);
  };

  const handleCloseStore = async () => {
    if (!effectiveStoreId) return;
    setCloseSubmitting(true);
    try {
      const dailyProductIds = new Set(dailyRows.map((r) => r.productId));
      const selections = products
        .filter((p) => dailyProductIds.has(p._id))
        .map((p) => ({
          productId: p._id,
          carryOver: closeSelections.get(p._id) ?? !p.isPerishable,
        }));
      const res = await fetch('/api/inventory/close-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: effectiveStoreId, date: selectedDate, selections }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to close store');
        return;
      }
      const isEditing = !!closingStatus;
      toast.success(isEditing ? 'Store closing updated' : 'Store closed for the day');
      setCloseDialogOpen(false);

      const [cy, cm, cd] = selectedDate.split('-').map(Number);
      const nextDt = new Date(Date.UTC(cy, cm - 1, cd + 1));
      const nextDayStr = `${nextDt.getUTCFullYear()}-${String(nextDt.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDt.getUTCDate()).padStart(2, '0')}`;
      setSelectedDate(nextDayStr);
      await refreshData(filterStoreId, nextDayStr);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setCloseSubmitting(false);
    }
  };

  const handleReopenStore = async () => {
    if (!effectiveStoreId || !closingStatus) return;
    setReopenSubmitting(true);
    try {
      const res = await fetch('/api/inventory/reopen-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId: effectiveStoreId, date: selectedDate }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to reopen store');
        return;
      }
      toast.success('Store reopened');
      await refreshData(filterStoreId);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setReopenSubmitting(false);
    }
  };

  const updateField = (field: keyof ProductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Build display rows from daily data ---
  // Only show products that have an inventory record for the selected date.
  // Products created after this date won't have records and should not appear.

  const productMap = new Map(products.map((p) => [p._id, p]));

  const displayRows = dailyRows.map((daily) => {
    const product = productMap.get(daily.productId);
    if (!product) return null;

    const displayInitialStock = daily.displayInitialStock ?? daily.initialStock + daily.restock;
    const currentStock = Math.max(0, displayInitialStock - daily.sold);
    const productCreatedDate = product.createdAt?.slice(0, 10) ?? '';
    const isCarriedOver = daily.initialStock > 0 && productCreatedDate < selectedDate;

    return {
      product,
      displayInitialStock,
      restock: daily.restock,
      sold: daily.sold,
      currentStock,
      isCarriedOver,
      carriedOverQty: isCarriedOver ? daily.initialStock : 0,
    };
  }).filter(Boolean) as Array<{
    product: Product;
    displayInitialStock: number;
    restock: number;
    sold: number;
    currentStock: number;
    isCarriedOver: boolean;
    carriedOverQty: number;
  }>;

  // --- Render ---

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground">Manage daily inventory and product catalog</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12 text-muted-foreground">Loading inventory...</div>
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Manage daily inventory and product catalog</p>
        </div>
        {isEditable && mainTab === 'products' && (
          <div className="flex items-center gap-2">
            {effectiveStoreId && (
              <Button
                variant={closingStatus ? 'outline' : 'default'}
                onClick={openCloseStore}
              >
                <Lock className="mr-1 h-4 w-4" />
                {closingStatus ? 'Edit Close' : 'Close Store'}
              </Button>
            )}
            <Button onClick={openCreate}>
              <Plus className="mr-1 h-4 w-4" />Add Product
            </Button>
          </div>
        )}
      </div>

      {/* Main tabs: Inventory | Inventory Report */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        <button
          type="button"
          onClick={() => setMainTab('products')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mainTab === 'products' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Inventory
        </button>
        <button
          type="button"
          onClick={() => setMainTab('inventory-report')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mainTab === 'inventory-report' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Package className="h-3.5 w-3.5" />
          Inventory Report
        </button>
      </div>

      {mainTab === 'inventory-report' ? (
        <ProductManagerInventoryReport
          storeId={effectiveStoreId}
          invDate={invDate}
          invData={invData}
          invLoading={invLoading}
          invError={invError}
          onInvDateChange={setInvDate}
          onFetch={fetchInventoryReport}
        />
      ) : (
        <>
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

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" onClick={() => shiftDate(-1)} title="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="rounded-md border bg-muted/50 px-3 py-1.5 text-sm font-medium tabular-nums w-32 text-center">
            {selectedDate}
          </div>
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

      {!isEditable && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Viewing inventory for <strong>{selectedDate}</strong> (read-only).
        </div>
      )}
      {closingStatus && (
        <div className="flex items-center gap-2 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          <Check className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Store closed for <strong>{selectedDate}</strong>. Selected products have been carried over to the next day&apos;s inventory.
          </span>
          {isEditable && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-green-400 text-green-800 hover:bg-green-100"
              onClick={handleReopenStore}
              disabled={reopenSubmitting}
            >
              <LockOpen className="mr-1 h-3.5 w-3.5" />
              {reopenSubmitting ? 'Reopening...' : 'Reopen Store'}
            </Button>
          )}
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
                  colSpan={isScoped ? (isEditable ? 10 : 9) : (isEditable ? 11 : 10)}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {isEditable ? 'No products found. Click "Add Product" to create one.' : 'No inventory records for this date.'}
                </td>
              </tr>
            ) : (
              displayRows.map(({ product, displayInitialStock, restock, sold, currentStock, isCarriedOver, carriedOverQty }) => (
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
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1">
                      <span>{displayInitialStock}</span>
                      {isCarriedOver && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help inline-flex">
                              <Info className="h-3.5 w-3.5 text-blue-500" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Carried over {carriedOverQty} item{carriedOverQty !== 1 ? 's' : ''} from previous day
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {restock > 0 ? (
                      <span className="text-blue-600 font-medium">+{restock}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
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

      {/* Close Store dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{closingStatus ? 'Edit Store Closing' : 'Close Store'}</DialogTitle>
            <DialogDescription>
              Select which products should carry over their remaining stock to tomorrow. Perishable products are unchecked by default.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {displayRows.map(({ product, currentStock }) => {
              const checked = closeSelections.get(product._id) ?? !product.isPerishable;
              return (
                <label
                  key={product._id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300"
                    checked={checked}
                    onChange={(e) => {
                      setCloseSelections((prev) => {
                        const next = new Map(prev);
                        next.set(product._id, e.target.checked);
                        return next;
                      });
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{product.name}</span>
                      <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${product.isPerishable ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                        {product.isPerishable ? 'Perishable' : 'Non-perishable'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <StockBadge value={currentStock} />
                  </div>
                </label>
              );
            })}
          </div>
          {displayRows.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No products to close.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCloseStore} disabled={closeSubmitting || displayRows.length === 0}>
              {closeSubmitting ? 'Saving...' : closingStatus ? 'Update Close' : 'Confirm Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      )}
    </div>
    </TooltipProvider>
  );
}

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CalendarClock, History, ImageIcon, Pencil, Plus, RotateCcw, Trash2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';
import { LocalDateTimeField } from './LocalDateTimeField';

type PreOrderProductStatus = 'pending' | 'ready';
type PreOrderOrderStatus = 'pending' | 'ready' | 'fulfilled' | 'cancelled';

interface PreOrderProduct {
  _id: string;
  name: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  discountPrice?: number | null;
  sellerName: string;
  notes: string;
  preOrderOpen: boolean;
  preOrderExpectedDate?: string | null;
  preOrderClosesAt?: string | null;
  preOrderStatus: PreOrderProductStatus;
  totalUnits: number;
  customerCount: number;
}

interface PreOrderLine {
  _id: string;
  customerName: string;
  customerEmail: string | null;
  quantity: number;
  subtotal: number;
  claimStatus: string;
  paymentStatus: string;
  preOrderStatus: PreOrderOrderStatus;
  customerNotes?: string | null;
  createdAt: string;
}

interface PreOrderOrdersResponse {
  totalUnits: number;
  customerCount: number;
  orders: PreOrderLine[];
}

interface PreOrderForm {
  name: string;
  images: string[];
  costPrice: string;
  sellingPrice: string;
  discountPrice: string;
  expectedDate: string;
  closesAt: string;
  sellerName: string;
  notes: string;
  preOrderOpen: boolean;
}

const emptyForm = (): PreOrderForm => ({
  name: '',
  images: [],
  costPrice: '',
  sellingPrice: '',
  discountPrice: '',
  expectedDate: '',
  closesAt: '',
  sellerName: '',
  notes: '',
  preOrderOpen: true,
});

const EST_TIMEZONE = 'America/New_York';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function formatLocalDateTime(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toLocalDateTimeInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateTimeToIso(value: string): string {
  return new Date(value).toISOString();
}

function formatEstDateTime(value?: string | null): string {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  const formatted = date.toLocaleString('en-US', {
    timeZone: EST_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${formatted} EST`;
}

interface PreOrderHistoryItem extends PreOrderProduct {
  timesListed: number;
  lastListedAt?: string | null;
  unlistedAt?: string | null;
}

function ProductImage({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center rounded bg-muted ${className}`}>
        <ImageIcon className="size-5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`rounded object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

function effectivePrice(product: Pick<PreOrderProduct, 'sellingPrice' | 'discountPrice'>): number {
  if (typeof product.discountPrice === 'number' && product.discountPrice >= 0) {
    return Math.min(product.discountPrice, product.sellingPrice);
  }
  return product.sellingPrice;
}

function StatusBadge({ status }: { status: PreOrderProductStatus | PreOrderOrderStatus }) {
  if (status === 'ready') return <Badge variant="info">Ready</Badge>;
  if (status === 'fulfilled') return <Badge variant="success">Fulfilled</Badge>;
  if (status === 'cancelled') return <Badge variant="error">Cancelled</Badge>;
  return <Badge variant="warning">Pending</Badge>;
}

export function PreOrderManager({ storeId }: { storeId: string }) {
  const [products, setProducts] = useState<PreOrderProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PreOrderProduct | null>(null);
  const [form, setForm] = useState<PreOrderForm>(emptyForm);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ordersFor, setOrdersFor] = useState<PreOrderProduct | null>(null);
  const [orders, setOrders] = useState<PreOrderOrdersResponse | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [pageTab, setPageTab] = useState<'current' | 'history'>('current');
  const [history, setHistory] = useState<PreOrderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [unlistTarget, setUnlistTarget] = useState<PreOrderProduct | null>(null);
  const [relistTarget, setRelistTarget] = useState<PreOrderHistoryItem | null>(null);
  const [relistClosesAt, setRelistClosesAt] = useState('');
  const [relistExpected, setRelistExpected] = useState('');
  const [relistSaving, setRelistSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PreOrderHistoryItem | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/preorders?storeId=${storeId}`);
      if (res.ok) setProducts(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/preorders/history?storeId=${storeId}`);
      if (res.ok) setHistory(await res.json());
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchHistory();
  }, [storeId]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:store', storeId);
    const onUpdate = (data: { productId: string; totalUnits: number; customerCount: number }) => {
      setProducts((prev) =>
        prev.map((product) =>
          product._id === data.productId
            ? { ...product, totalUnits: data.totalUnits, customerCount: data.customerCount }
            : product
        )
      );
    };
    socket.on('preorder:updated', onUpdate);
    return () => {
      socket.off('preorder:updated', onUpdate);
      socket.emit('leave:store', storeId);
    };
  }, [storeId]);

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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setNewImageUrl('');
    setDialogOpen(true);
  };

  const openEdit = (product: PreOrderProduct) => {
    setEditing(product);
    setNewImageUrl('');
    setForm({
      name: product.name,
      images: product.images ?? [],
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      discountPrice: product.discountPrice == null ? '' : String(product.discountPrice),
      expectedDate: toLocalDateTimeInput(product.preOrderExpectedDate),
      closesAt: toLocalDateTimeInput(product.preOrderClosesAt),
      sellerName: product.sellerName ?? '',
      notes: product.notes ?? '',
      preOrderOpen: product.preOrderOpen,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = form.name.trim();
    const costPrice = Number(form.costPrice);
    const sellingPrice = Number(form.sellingPrice);
    const discountRaw = form.discountPrice.trim();
    const discountPrice = discountRaw === '' ? null : Number(discountRaw);

    if (!name) {
      toast.error('Product name is required');
      return;
    }
    if (!form.closesAt) {
      toast.error('Set the date and time when pre-orders close');
      return;
    }
    if (!Number.isFinite(costPrice) || costPrice < 0 || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
      toast.error('Prices must be zero or greater');
      return;
    }
    if (discountPrice != null && (!Number.isFinite(discountPrice) || discountPrice < 0)) {
      toast.error('Discount price must be a valid number');
      return;
    }
    if (discountPrice != null && discountPrice > sellingPrice) {
      toast.error('Discount price cannot be greater than selling price');
      return;
    }

    const body = {
      storeId,
      name,
      images: form.images,
      costPrice,
      sellingPrice,
      discountPrice,
      sellerName: form.sellerName.trim(),
      notes: form.notes.trim(),
      preOrderOpen: form.preOrderOpen,
      preOrderExpectedDate: form.expectedDate ? localDateTimeToIso(form.expectedDate) : null,
      preOrderClosesAt: localDateTimeToIso(form.closesAt),
      productType: 'preorder',
      stockQuantity: 0,
    };

    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/products/${editing._id}` : '/api/products', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Could not save pre-order');
        return;
      }
      toast.success(editing ? 'Pre-order updated' : 'Pre-order created');
      setDialogOpen(false);
      await fetchProducts();
    } catch {
      toast.error('Could not save pre-order');
    } finally {
      setSaving(false);
    }
  };

  const patchProduct = async (product: PreOrderProduct, patch: Record<string, unknown>, success: string) => {
    setBusyId(product._id);
    try {
      const res = await fetch(`/api/products/${product._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Update failed');
        return;
      }
      toast.success(success);
      setProducts((prev) =>
        prev.map((item) => (item._id === product._id ? { ...item, ...(data as PreOrderProduct) } : item))
      );
    } catch {
      toast.error('Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const confirmUnlist = async () => {
    if (!unlistTarget) return;
    setBusyId(unlistTarget._id);
    try {
      const res = await fetch(`/api/preorders/${unlistTarget._id}/unlist`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Could not unlist');
        return;
      }
      toast.success('Moved to listing history');
      setUnlistTarget(null);
      await Promise.all([fetchProducts(), fetchHistory()]);
    } catch {
      toast.error('Could not unlist');
    } finally {
      setBusyId(null);
    }
  };

  const openRelist = (product: PreOrderHistoryItem) => {
    setRelistTarget(product);
    setRelistClosesAt('');
    setRelistExpected(toLocalDateTimeInput(product.preOrderExpectedDate));
  };

  const confirmRelist = async () => {
    if (!relistTarget) return;
    if (!relistClosesAt) {
      toast.error('Set the date and time when pre-orders close');
      return;
    }
    setRelistSaving(true);
    try {
      const res = await fetch(`/api/preorders/${relistTarget._id}/relist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preOrderClosesAt: localDateTimeToIso(relistClosesAt),
          preOrderExpectedDate: relistExpected ? localDateTimeToIso(relistExpected) : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Could not relist');
        return;
      }
      toast.success('Pre-order listed again');
      setRelistTarget(null);
      setPageTab('current');
      await Promise.all([fetchProducts(), fetchHistory()]);
    } catch {
      toast.error('Could not relist');
    } finally {
      setRelistSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget._id);
    try {
      const res = await fetch(`/api/products/${deleteTarget._id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { message?: string }).message ?? 'Could not delete');
        return;
      }
      toast.success('Pre-order deleted');
      setDeleteTarget(null);
      await fetchHistory();
    } catch {
      toast.error('Could not delete');
    } finally {
      setBusyId(null);
    }
  };

  const openOrders = async (product: PreOrderProduct) => {
    setOrdersFor(product);
    setOrders(null);
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/preorders/${product._id}/orders`);
      if (res.ok) setOrders(await res.json());
      else toast.error('Could not load orders');
    } catch {
      toast.error('Could not load orders');
    } finally {
      setOrdersLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pre-Orders</h1>
          <p className="text-sm text-muted-foreground">
            Demand for items you do not have in stock yet. These products are not part of inventory.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Create Pre-Order
        </Button>
      </div>

      <Tabs value={pageTab} onValueChange={(value) => setPageTab(value as 'current' | 'history')}>
        <TabsList>
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="history">
            <History />
            Listing History
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {pageTab === 'history' ? (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <div className="data-table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Product</th>
                    <th className="px-4 py-3 text-right font-semibold">Price</th>
                    <th className="px-4 py-3 text-left font-semibold">Last listed</th>
                    <th className="px-4 py-3 text-left font-semibold">Unlisted</th>
                    <th className="px-4 py-3 text-right font-semibold">Times listed</th>
                    <th className="px-4 py-3 text-right font-semibold">Still to prepare</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center"><Spinner className="mx-auto" /></td>
                    </tr>
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12">
                        <Empty className="border-0">
                          <EmptyHeader>
                            <EmptyMedia variant="icon"><History /></EmptyMedia>
                            <EmptyTitle>No unlisted pre-orders</EmptyTitle>
                            <EmptyDescription>Unlist a current pre-order to keep it here and list it again later.</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </td>
                    </tr>
                  ) : history.map((product) => (
                    <tr key={product._id}>
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(effectivePrice(product))}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatEstDateTime(product.lastListedAt)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{formatEstDateTime(product.unlistedAt)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{product.timesListed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{product.totalUnits}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => openOrders(product)}>
                            <Users data-icon="inline-start" />
                            View Orders
                          </Button>
                          <Button variant="default" size="sm" onClick={() => openRelist(product)}>
                            <RotateCcw data-icon="inline-start" />
                            Relist
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(product)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : (
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <div className="data-table-scroll-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">Price</th>
                  <th className="px-4 py-3 text-right font-semibold">Pre-Ordered</th>
                  <th className="px-4 py-3 text-right font-semibold">Customers</th>
                  <th className="px-4 py-3 text-left font-semibold">Expected</th>
                  <th className="px-4 py-3 text-left font-semibold">Orders close</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Open</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <Spinner className="mx-auto" />
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12">
                      <Empty className="border-0">
                        <EmptyHeader>
                          <EmptyMedia variant="icon"><CalendarClock /></EmptyMedia>
                          <EmptyTitle>No pre-order products</EmptyTitle>
                          <EmptyDescription>Create one to start collecting demand before you buy stock.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product._id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt="" className="size-10 rounded-md object-cover" />
                          ) : (
                            <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                              <ImageIcon className="size-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <Badge variant="warning" className="mt-1">Pre-Order</Badge>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmt(effectivePrice(product))}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold tabular-nums">{product.totalUnits}</span>
                        <span className="block text-xs text-muted-foreground">units</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{product.customerCount}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatLocalDateTime(product.preOrderExpectedDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatLocalDateTime(product.preOrderClosesAt)}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={product.preOrderStatus} /></td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={product.preOrderOpen}
                          disabled={busyId === product._id}
                          aria-label={product.preOrderOpen ? 'Close pre-order' : 'Open pre-order'}
                          onCheckedChange={(checked) =>
                            patchProduct(
                              product,
                              { preOrderOpen: checked },
                              checked ? 'Pre-order opened' : 'Pre-order closed'
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                            <Pencil data-icon="inline-start" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyId === product._id}
                            onClick={() =>
                              patchProduct(
                                product,
                                { preOrderStatus: product.preOrderStatus === 'ready' ? 'pending' : 'ready' },
                                product.preOrderStatus === 'ready' ? 'Marked pending' : 'Marked ready'
                              )
                            }
                          >
                            {product.preOrderStatus === 'ready' ? 'Reopen' : 'Mark Ready'}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setUnlistTarget(product)}>
                            Unlist
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openOrders(product)}>
                            <Users data-icon="inline-start" />
                            View Orders
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Pre-Order' : 'Create Pre-Order'}</DialogTitle>
            <DialogDescription>
              Pre-order products start at zero stock and never reduce inventory.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preorder-name">Product name</Label>
              <Input
                id="preorder-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preorder-cost">Cost price</Label>
                <Input
                  id="preorder-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="preorder-price">Selling price</Label>
                <Input
                  id="preorder-price"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preorder-discount">Discount price</Label>
              <Input
                id="preorder-discount"
                type="number"
                min="0"
                step="0.01"
                placeholder="Optional"
                value={form.discountPrice}
                onChange={(e) => setForm({ ...form, discountPrice: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label id="preorder-date-label">Expected availability</Label>
              <LocalDateTimeField
                id="preorder-date"
                value={form.expectedDate}
                onChange={(expectedDate) => setForm({ ...form, expectedDate })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label id="preorder-closes-label">Orders close</Label>
              <LocalDateTimeField
                id="preorder-closes"
                value={form.closesAt}
                onChange={(closesAt) => setForm({ ...form, closesAt })}
              />
              <p className="text-xs text-muted-foreground">
                Customers cannot pre-order after this time. Times use your local clock. It can share a day with expected availability when it is earlier.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preorder-seller">Seller name</Label>
              <Input
                id="preorder-seller"
                value={form.sellerName}
                onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="preorder-notes">Notes</Label>
              <Textarea
                id="preorder-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Product Images</Label>
              {form.images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.images.map((url, i) => (
                    <div key={i} className="group relative">
                      <ProductImage src={url} className="size-16 border" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => removeImage(i)}
                        className="absolute -right-1.5 -top-1.5 hidden size-5 rounded-full group-hover:flex"
                      >
                        <X />
                      </Button>
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
                  <Plus />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Add image URLs one at a time. The first image will be used as the thumbnail.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="preorder-open">Accepting pre-orders</Label>
              <Switch
                id="preorder-open"
                checked={form.preOrderOpen}
                onCheckedChange={(checked) => setForm({ ...form, preOrderOpen: checked })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Spinner data-icon="inline-start" /> : null}
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={ordersFor != null} onOpenChange={(open) => { if (!open) setOrdersFor(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{ordersFor?.name ?? 'Orders'}</DialogTitle>
            <DialogDescription>
              {orders
                ? `${orders.customerCount} customers · ${orders.totalUnits} total units to prepare`
                : 'Customers who pre-ordered this product.'}
            </DialogDescription>
          </DialogHeader>
          {ordersLoading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : !orders || orders.orders.length === 0 ? (
            <Empty className="border-0 py-8">
              <EmptyHeader>
                <EmptyTitle>No pre-orders yet</EmptyTitle>
                <EmptyDescription>Orders will show up here as customers place them.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="data-table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Customer</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.orders.map((order) => (
                    <tr key={order._id}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{order.customerName}</div>
                        {order.customerEmail && (
                          <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                        )}
                        {order.customerNotes && (
                          <div className="mt-1 text-xs text-muted-foreground">{order.customerNotes}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{order.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmt(order.subtotal)}</td>
                      <td className="px-3 py-2"><StatusBadge status={order.preOrderStatus} /></td>
                      <td className="px-3 py-2 text-sm text-muted-foreground whitespace-nowrap">
                        {formatEstDateTime(order.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={unlistTarget != null} onOpenChange={(open) => { if (!open) setUnlistTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlist {unlistTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves the storefront and moves to listing history. Existing pre-orders stay on the books. You can list it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlist}>Unlist</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={relistTarget != null} onOpenChange={(open) => { if (!open) setRelistTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Relist {relistTarget?.name}</DialogTitle>
            <DialogDescription>
              Set a new local deadline. Ordering opens again, and the product goes back to pending.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Orders close</Label>
              <LocalDateTimeField
                id="relist-closes"
                value={relistClosesAt}
                onChange={setRelistClosesAt}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Expected availability</Label>
              <LocalDateTimeField
                id="relist-expected"
                value={relistExpected}
                onChange={setRelistExpected}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRelistTarget(null)}>Cancel</Button>
            <Button onClick={confirmRelist} disabled={relistSaving}>
              {relistSaving ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}
              Relist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the pre-order product. Orders already placed stay in Transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

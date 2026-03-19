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
import { Activity, Check, ChevronLeft, ChevronRight, Download, Grid2x2, Grid3x3, History, ImageIcon, Info, LayoutGrid, Lock, LockOpen, NotepadText, Package, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';

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
  discountPrice?: number | null;
  stockQuantity: number;
  isPerishable: boolean;
  sellerName: string;
  notes: string;
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
  sellerName: string;
  notes: string;
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
  discountPrice: string;
  stockQuantity: string;
  isPerishable: boolean;
  sellerName: string;
  notes: string;
}

interface InvReportProduct {
  productId: string;
  productName: string;
  isPerishable: boolean;
  costPrice: number;
  sellingPrice: number;
  discountPrice?: number | null;
  sellerName: string;
  notes: string;
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

interface InvReportRecord {
  _id: string;
  reportDate: string;
  fileName: string;
  generatedBy: { _id: string; name: string } | null;
  createdAt: string;
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
          ? 'bg-destructive/15 text-destructive'
          : value < 10
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-primary/20 text-primary'
      }`}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inventory Report History (saved reports table)
// ---------------------------------------------------------------------------

function InventoryReportHistory({ storeId }: { storeId: string }) {
  const [reports, setReports] = useState<InvReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<InvReportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/inventory-reports?storeId=${storeId}`);
      if (res.ok) setReports(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [storeId]);

  const handleDownload = async (reportId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/inventory-reports/${reportId}/download`);
      if (!res.ok) {
        toast.error('Download failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/inventory-reports/${deleteTarget._id}`, { method: 'DELETE' });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r._id !== deleteTarget._id));
        toast.success('Report deleted');
      } else {
        toast.error('Failed to delete report');
      }
    } catch {
      toast.error('Failed to delete report');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading report history...</div>;
  }

  const paginatedReports = reports.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
        <div className="data-table-scroll-wrapper flex-1 min-h-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date/Time Generated</th>
                <th>Generated By</th>
                <th>Report Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No reports generated yet
                  </td>
                </tr>
              ) : (
                paginatedReports.map((r) => (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td>
                      {r.generatedBy?.name ?? <span className="text-muted-foreground italic">Unknown</span>}
                    </td>
                    <td className="font-mono text-xs">{r.reportDate}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(r._id, r.fileName)}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(r)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {reports.length > 0 && (
          <TablePagination
            currentPage={page}
            totalItems={reports.length}
            onPageChange={setPage}
            label="reports"
          />
        )}
      </div>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-md border px-4 py-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Report Date:</span> <span className="font-mono">{deleteTarget.reportDate}</span></p>
              <p><span className="text-muted-foreground">Generated By:</span> {deleteTarget.generatedBy?.name ?? 'Unknown'}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Yes, Delete Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
  onGenerateAndSave,
  onDownloadExcel,
}: {
  storeId: string | undefined;
  invDate: string;
  invData: InventoryReportData | null;
  invLoading: boolean;
  invError: string;
  onInvDateChange: (d: string) => void;
  onFetch: () => void;
  onGenerateAndSave?: () => Promise<void>;
  onDownloadExcel?: () => Promise<void>;
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

  const [invPage, setInvPage] = useState(1);
  useEffect(() => {
    setInvPage(1);
  }, [invData?.date]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Date</Label>
          <Input type="date" value={invDate} onChange={(e) => onInvDateChange(e.target.value)} className="w-40" />
        </div>
        <Button onClick={onFetch} disabled={invLoading}>{invLoading ? 'Loading...' : 'Load Report'}</Button>
        {onGenerateAndSave && (
          <Button variant="secondary" onClick={onGenerateAndSave} disabled={invLoading}>
            Generate & Save Report
          </Button>
        )}
        {onDownloadExcel && (
          <Button variant="outline" onClick={onDownloadExcel} disabled={invLoading || !invData}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Download Excel
          </Button>
        )}
      </div>

      {invError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{invError}</div>
      )}

      {!invLoading && invData && (
        <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Inventory Report — {invData.date}</h3>
          </div>
          {invData.products.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No inventory records for this date.</p>
          ) : (
            <>
              <div className="data-table-scroll-wrapper flex-1 min-h-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Seller</th>
                      <th className="w-10">Notes</th>
                      <th>Type</th>
                      <th>Cost</th>
                      <th>Selling</th>
                      <th>Discount</th>
                      <th className="text-right">Initial</th>
                      <th className="text-right">Restock</th>
                      <th className="text-right">Sold</th>
                      <th className="text-right">Current</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invData.products
                      .slice((invPage - 1) * ITEMS_PER_PAGE, invPage * ITEMS_PER_PAGE)
                      .map((p) => (
                  <tr key={p.productId}>
                    <td className="px-4 py-2.5 font-medium">{p.productName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.sellerName || '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      {p.notes ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help inline-flex">
                                <NotepadText className="h-4 w-4 text-muted-foreground" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap">
                              {p.notes}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${p.isPerishable ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {p.isPerishable ? 'Perishable' : 'Non-perishable'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{fmt(p.costPrice)}</td>
                    <td className="px-4 py-2.5">{fmt(p.sellingPrice)}</td>
                    <td className="px-4 py-2.5">
                      {typeof p.discountPrice === 'number' ? fmt(p.discountPrice) : '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{p.displayInitialStock}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.restock > 0 ? <span className="text-primary font-medium">+{p.restock}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.sold > 0 ? <span className="text-primary font-medium">{p.sold}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="text-right"><StockBadge value={p.currentStock} /></td>
                  </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {totals && (
                <div className="border-t border-border px-4 py-2 flex flex-wrap items-center gap-4 text-sm font-semibold bg-muted/50">
                  <span>Total</span>
                  <span className="tabular-nums">Initial: {totals.initialStock}</span>
                  <span className="tabular-nums text-primary">Restock: +{totals.restock}</span>
                  <span className="tabular-nums text-primary">Sold: {totals.sold}</span>
                  <span className="tabular-nums">Current: <StockBadge value={totals.currentStock} /></span>
                </div>
              )}
              <TablePagination
                currentPage={invPage}
                totalItems={invData.products.length}
                onPageChange={setInvPage}
                label="products"
              />
            </>
          )}
        </div>
      )}

      {!invLoading && !invData && !invError && (
        <p className="py-8 text-center text-muted-foreground">Select a date and click &quot;Generate Report&quot; to view inventory data.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Realtime Stocks — live product stock overview with WebSocket updates
// ---------------------------------------------------------------------------

type GridCols = 3 | 6 | 9;

interface RtProduct {
  _id: string;
  name: string;
  images: string[];
  sellingPrice: number;
  stockQuantity: number;
}

function RealtimeStocksImage({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-muted ${className}`}>
        <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`object-cover ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

function RealtimeStocks({ storeId }: { storeId: string }) {
  const [products, setProducts] = useState<RtProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState<GridCols>(6);
  const [search, setSearch] = useState('');
  const flashSet = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  const applyUpdate = useCallback((updated: RtProduct[]) => {
    setProducts((prev) => {
      const prevMap = new Map(prev.map((p) => [p._id, p]));
      const changedIds: string[] = [];
      for (const p of updated) {
        const old = prevMap.get(p._id);
        if (old && old.stockQuantity !== p.stockQuantity) {
          changedIds.push(p._id);
        }
      }

      if (changedIds.length > 0) {
        for (const id of changedIds) flashSet.current.add(id);
        forceRender((n) => n + 1);
        setTimeout(() => {
          for (const id of changedIds) flashSet.current.delete(id);
          forceRender((n) => n + 1);
        }, 1200);
      }

      return updated;
    });
  }, []);

  const fetchProducts = useCallback(async (silent = false) => {
    try {
      const res = await fetch(`/api/products?storeId=${storeId}&dailyOnly=true`);
      if (res.ok) {
        const data: RtProduct[] = await res.json();
        if (silent) {
          applyUpdate(data);
        } else {
          setProducts(data);
        }
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [storeId, applyUpdate]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Socket-based updates — filter to only daily-inventory products
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:store', storeId);

    const handleSocketUpdate = (updated: RtProduct[]) => {
      setProducts((prev) => {
        const dailyIds = new Set(prev.map((p) => p._id));
        const filtered = updated.filter((p) => dailyIds.has(p._id));
        const prevMap = new Map(prev.map((p) => [p._id, p]));
        const changedIds: string[] = [];
        for (const p of filtered) {
          const old = prevMap.get(p._id);
          if (old && old.stockQuantity !== p.stockQuantity) {
            changedIds.push(p._id);
          }
        }

        if (changedIds.length > 0) {
          for (const id of changedIds) flashSet.current.add(id);
          forceRender((n) => n + 1);
          setTimeout(() => {
            for (const id of changedIds) flashSet.current.delete(id);
            forceRender((n) => n + 1);
          }, 1200);
        }

        return filtered;
      });
    };

    socket.on('stock:updated', handleSocketUpdate);
    return () => {
      socket.off('stock:updated', handleSocketUpdate);
      socket.emit('leave:store', storeId);
    };
  }, [storeId]);

  // Polling fallback — keeps data fresh even when sockets aren't available
  useEffect(() => {
    const interval = setInterval(() => fetchProducts(true), 5000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  const LOW_STOCK_THRESHOLD = 5;

  const filtered = products
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aOOS = a.stockQuantity === 0 ? 1 : 0;
      const bOOS = b.stockQuantity === 0 ? 1 : 0;
      if (aOOS !== bOOS) return aOOS - bOOS;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

  const gridClass =
    cols === 3
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : cols === 6
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
        : 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-9';

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground">Loading products…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
          {([3, 6, 9] as GridCols[]).map((n) => {
            const Icon = n === 3 ? LayoutGrid : n === 6 ? Grid3x3 : Grid2x2;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setCols(n)}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  cols === n
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title={`${n} columns`}
              >
                <Icon className="h-3.5 w-3.5" />
                {n}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} product{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Package className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">
            {search ? 'No products match your search.' : 'No products in this store.'}
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${gridClass}`}>
          {filtered.map((product) => {
            const isOOS = product.stockQuantity === 0;
            const isLow = !isOOS && product.stockQuantity <= LOW_STOCK_THRESHOLD;
            const isFlashing = flashSet.current.has(product._id);

            return (
              <div
                key={product._id}
                className={`relative rounded-xl border bg-card overflow-hidden flex flex-col transition-all duration-300 ${
                  isOOS ? 'opacity-50 border-border/40' : 'border-border/60'
                } ${isFlashing ? 'ring-2 ring-primary/60 shadow-lg shadow-primary/10' : ''}`}
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <RealtimeStocksImage
                    src={product.images?.[0]}
                    className="h-full w-full"
                  />
                  {isOOS && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="bg-destructive text-destructive-foreground text-[10px] font-semibold px-2.5 py-1 rounded-full">
                        Out of Stock
                      </span>
                    </div>
                  )}
                  {isLow && (
                    <div className="absolute top-1.5 right-1.5">
                      <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                        Low
                      </span>
                    </div>
                  )}
                  {isFlashing && (
                    <div className="absolute inset-0 bg-primary/10 animate-pulse pointer-events-none" />
                  )}
                </div>
                <div className="p-3 flex flex-col gap-1 flex-1">
                  <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
                  <p className="text-sm font-bold text-primary">{fmt(product.sellingPrice)}</p>
                  <div className="mt-auto pt-1.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Stock</span>
                    <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                          isOOS
                            ? 'bg-destructive/15 text-destructive'
                            : isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-primary/15 text-primary'
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                    </div>
                  </div>
                </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ProductManager
// ---------------------------------------------------------------------------

export function ProductManager({ storeId: fixedStoreId }: ProductManagerProps) {
  const isScoped = !!fixedStoreId;
  const todayStr = toLocalDateStr(new Date());

  const emptyForm: ProductFormData = {
    storeId: fixedStoreId ?? '',
    name: '',
    images: [],
    costPrice: '',
    sellingPrice: '',
    discountPrice: '',
    stockQuantity: '',
    isPerishable: false,
    sellerName: '',
    notes: '',
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
  const [reduceQty, setReduceQty] = useState('');

  type MainTab = 'products' | 'realtime-stocks' | 'inventory-report';
  const [mainTab, setMainTab] = useState<MainTab>('products');
  const [invDate, setInvDate] = useState(todayStr);
  const [invData, setInvData] = useState<InventoryReportData | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');
  type InvReportSubTab = 'report' | 'history';
  const [invReportSubTab, setInvReportSubTab] = useState<InvReportSubTab>('report');
  const [invReportHistoryKey, setInvReportHistoryKey] = useState(0);

  // Store closing state
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingStatus, setClosingStatus] = useState<StoreClosingData | null>(null);
  const [closeSelections, setCloseSelections] = useState<Map<string, boolean>>(new Map());
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [productsPage, setProductsPage] = useState(1);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<'all' | 'perishable' | 'non-perishable'>('all');
  const [reduceDialogProduct, setReduceDialogProduct] = useState<{ _id: string; name: string; stockQuantity: number } | null>(null);
  const [reduceDialogQty, setReduceDialogQty] = useState('');
  const [reduceSubmitting, setReduceSubmitting] = useState(false);

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
    setDailyRows([]);
    fetchDailyInventory(selectedDate);
    fetchClosingStatus(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    setProductsPage(1);
  }, [selectedDate, filterStoreId, inventorySearch, inventoryTypeFilter]);

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

  const handleGenerateAndSaveReport = async () => {
    if (!effectiveStoreId) return;
    setInvLoading(true);
    setInvError('');
    try {
      const params = new URLSearchParams({ storeId: effectiveStoreId, date: invDate });
      const resReport = await fetch(`/api/reports/inventory?${params}`);
      if (!resReport.ok) throw new Error('Failed to load inventory report');
      setInvData(await resReport.json());

      const resSave = await fetch(`/api/inventory-reports/generate?${params}`, { method: 'POST' });
      if (!resSave.ok) {
        const data = (await resSave.json()) as { message?: string };
        throw new Error(data.message ?? 'Failed to save report');
      }
      toast.success('Report generated and saved');
      setInvReportHistoryKey((k) => k + 1);
    } catch (e) {
      setInvError(e instanceof Error ? e.message : 'Error');
      toast.error(e instanceof Error ? e.message : 'Failed to save report');
    } finally {
      setInvLoading(false);
    }
  };

  const handleReduceStockSubmit = async () => {
    if (!reduceDialogProduct || !effectiveStoreId) return;
    const qty = parseInt(reduceDialogQty, 10);
    if (!qty || qty <= 0) {
      toast.error('Enter a valid quantity to reduce');
      return;
    }
    setReduceSubmitting(true);
    try {
      const res = await fetch(`/api/inventory/reduce/${reduceDialogProduct._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: qty,
          storeId: effectiveStoreId,
          date: todayStr,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? 'Failed to reduce stock');
        return;
      }
      toast.success('Stock reduced');
      setReduceDialogProduct(null);
      setReduceDialogQty('');
      await refreshData(filterStoreId);
    } catch {
      toast.error('Network error');
    } finally {
      setReduceSubmitting(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!effectiveStoreId) return;
    try {
      const params = new URLSearchParams({ storeId: effectiveStoreId, date: invDate });
      const res = await fetch(`/api/inventory-reports/export?${params}`);
      if (!res.ok) {
        toast.error('Download failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory_report_${invDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded');
    } catch {
      toast.error('Download failed');
    }
  };

  // --- Product CRUD helpers ---

  const openCreate = () => {
    setEditingProduct(null);
    setForm(emptyForm);
    setRestockQty('');
    setReduceQty('');
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
      discountPrice: product.discountPrice == null ? '' : String(product.discountPrice),
      stockQuantity: String(product.stockQuantity),
      isPerishable: product.isPerishable ?? false,
      sellerName: product.sellerName ?? '',
      notes: product.notes ?? '',
    });
    setRestockQty('');
    setReduceQty('');
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
      const sellingPrice = parseFloat(form.sellingPrice) || 0;
      const hasDiscount = form.discountPrice.trim().length > 0;
      const rawDiscountPrice = hasDiscount ? parseFloat(form.discountPrice) : null;
      const parsedDiscountPrice = rawDiscountPrice === 0 ? null : rawDiscountPrice;

      if (hasDiscount && (!Number.isFinite(parsedDiscountPrice) || (parsedDiscountPrice ?? 0) < 0)) {
        const msg = 'Discount price must be a valid non-negative number';
        setError(msg);
        toast.error(msg);
        return;
      }
      if (parsedDiscountPrice != null && parsedDiscountPrice > sellingPrice) {
        const msg = 'Discount price cannot be greater than selling price';
        setError(msg);
        toast.error(msg);
        return;
      }

      if (editingProduct) {
        const productPayload = {
          storeId: form.storeId,
          name: form.name.trim(),
          images: form.images,
          costPrice: parseFloat(form.costPrice) || 0,
          sellingPrice,
          discountPrice: parsedDiscountPrice,
          isPerishable: form.isPerishable,
          sellerName: form.sellerName.trim(),
          notes: form.notes.trim(),
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
        const reduceAmount = parseInt(reduceQty, 10);
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
        }
        if (reduceAmount > 0) {
          const reduceRes = await fetch(`/api/inventory/reduce/${editingProduct._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: reduceAmount, storeId: form.storeId, date: todayStr }),
          });
          if (!reduceRes.ok) {
            const data = (await reduceRes.json()) as { message?: string };
            const msg = data.message ?? 'Failed to reduce stock';
            setError(msg);
            toast.error(msg);
            return;
          }
          toast.success('Stock reduced');
        }
        if (qty <= 0 && reduceAmount <= 0) {
          toast.success('Product updated');
        }
      } else {
        const payload = {
          storeId: form.storeId,
          name: form.name.trim(),
          images: form.images,
          costPrice: parseFloat(form.costPrice) || 0,
          sellingPrice,
          discountPrice: parsedDiscountPrice,
          stockQuantity: parseInt(form.stockQuantity, 10) || 0,
          isPerishable: form.isPerishable,
          sellerName: form.sellerName.trim(),
          notes: form.notes.trim(),
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

    // Seed from any previously saved closing — all persisted selections are
    // respected unconditionally so previously checked perishable items remain
    // checked when revisiting or editing.
    if (closingStatus) {
      for (const sel of closingStatus.carryOverSelections) {
        defaults.set(sel.productId, sel.carryOver);
      }
    }

    // Fill in defaults only for products that have no saved entry yet.
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
      setDailyRows([]);
      setLoading(true);
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

  const filteredAndSortedRows = displayRows
    .filter((row) => {
      const q = inventorySearch.trim().toLowerCase();
      if (q) {
        const nameMatch = row.product.name.toLowerCase().includes(q);
        const sellerMatch = (row.product.sellerName ?? '').toLowerCase().includes(q);
        if (!nameMatch && !sellerMatch) return false;
      }
      if (inventoryTypeFilter === 'perishable' && !row.product.isPerishable) return false;
      if (inventoryTypeFilter === 'non-perishable' && row.product.isPerishable) return false;
      return true;
    })
    .sort((a, b) => a.product.name.localeCompare(b.product.name, undefined, { sensitivity: 'base' }));

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

      {/* Main tabs: Inventory | Realtime Stocks | Inventory Report */}
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
          onClick={() => setMainTab('realtime-stocks')}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mainTab === 'realtime-stocks' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Activity className="h-3.5 w-3.5" />
          Realtime Stocks
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

      {mainTab === 'realtime-stocks' ? (
        effectiveStoreId ? (
          <RealtimeStocks storeId={effectiveStoreId} />
        ) : (
          <p className="rounded-lg border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
            Select a store above to view realtime stocks.
          </p>
        )
      ) : mainTab === 'inventory-report' ? (
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
            <button
              type="button"
              onClick={() => setInvReportSubTab('report')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${invReportSubTab === 'report' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Package className="h-3.5 w-3.5" />
              Report
            </button>
            <button
              type="button"
              onClick={() => setInvReportSubTab('history')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${invReportSubTab === 'history' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <History className="h-3.5 w-3.5" />
              Report History
            </button>
          </div>
          {invReportSubTab === 'report' ? (
            <ProductManagerInventoryReport
              storeId={effectiveStoreId}
              invDate={invDate}
              invData={invData}
              invLoading={invLoading}
              invError={invError}
              onInvDateChange={setInvDate}
              onFetch={fetchInventoryReport}
              onGenerateAndSave={handleGenerateAndSaveReport}
              onDownloadExcel={handleDownloadExcel}
            />
          ) : effectiveStoreId ? (
            <InventoryReportHistory key={invReportHistoryKey} storeId={effectiveStoreId} />
          ) : (
            <p className="rounded-lg border bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">
              Select a store above to view report history.
            </p>
          )}
        </div>
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

        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Search:</Label>
          <Input
            type="search"
            placeholder="Name or seller..."
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            className="w-44 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Type:</Label>
          <Select value={inventoryTypeFilter} onValueChange={(v: 'all' | 'perishable' | 'non-perishable') => setInventoryTypeFilter(v)}>
            <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="perishable">Perishable</SelectItem>
              <SelectItem value="non-perishable">Non-perishable</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
        <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Viewing inventory for <strong className="text-foreground">{selectedDate}</strong> (read-only).
        </div>
      )}
      {closingStatus && (
        <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground">
          <Check className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1">
            Store closed for <strong>{selectedDate}</strong>. Selected products have been carried over to the next day&apos;s inventory.
          </span>
          {isEditable && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto border-primary text-primary hover:bg-primary/15"
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
      <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
        <div className="data-table-scroll-wrapper flex-1 min-h-0">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-16 text-center">Image</th>
                <th className="text-center">Name</th>
                <th className="text-center">Seller</th>
                <th className="w-10 text-center">Notes</th>
                <th className="text-center">Type</th>
                {!isScoped && (
                  <th className="text-center">Store</th>
                )}
                <th className="text-center">Cost</th>
                <th className="text-center">Selling</th>
                <th className="text-center">Discount</th>
                <th className="text-center">Initial</th>
                <th className="text-center">Restock</th>
                <th className="text-center">Sold</th>
                <th className="text-center">Current</th>
                {isEditable && (
                  <th className="text-center">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={isScoped ? (isEditable ? 13 : 12) : (isEditable ? 14 : 13)}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {displayRows.length > 0
                      ? 'No products match your filters.'
                      : isEditable
                        ? 'No products found. Click "Add Product" to create one.'
                        : 'No inventory records for this date.'}
                  </td>
                </tr>
              ) : (
                filteredAndSortedRows
                  .slice((productsPage - 1) * ITEMS_PER_PAGE, productsPage * ITEMS_PER_PAGE)
                  .map(({ product, displayInitialStock, restock, sold, currentStock, isCarriedOver, carriedOverQty }) => (
                <tr key={product._id}>
                  <td className="px-4 py-2">
                    <ProductImage src={product.images?.[0]} className="h-10 w-10" />
                  </td>
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{product.sellerName || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {product.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help inline-flex">
                            <NotepadText className="h-4 w-4 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs whitespace-pre-wrap">
                          {product.notes}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${product.isPerishable ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {product.isPerishable ? 'Perishable' : 'Non-perishable'}
                    </span>
                  </td>
                  {!isScoped && (
                    <td className="px-4 py-3 text-muted-foreground">{storeMap.get(product.storeId) ?? '-'}</td>
                  )}
                  <td className="px-4 py-3">{fmt(product.costPrice)}</td>
                  <td className="px-4 py-3">{fmt(product.sellingPrice)}</td>
                  <td className="px-4 py-3">
                    {typeof product.discountPrice === 'number' ? fmt(product.discountPrice) : '-'}
                  </td>
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
                      <span className="text-primary font-medium">+{restock}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {sold > 0 ? (
                      <span className="text-primary font-medium">{sold}</span>
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
        {filteredAndSortedRows.length > 0 && (
          <TablePagination
            currentPage={productsPage}
            totalItems={filteredAndSortedRows.length}
            onPageChange={setProductsPage}
            label="products"
          />
        )}
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

            <div className="space-y-2">
              <Label htmlFor="product-seller">Seller Name</Label>
              <Input
                id="product-seller"
                placeholder="e.g. Juan's Farm Supply"
                value={form.sellerName}
                onChange={(e) => updateField('sellerName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-notes">Additional Notes</Label>
              <textarea
                id="product-notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Any additional notes about this product..."
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
              />
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
            <div className="space-y-2">
              <Label htmlFor="product-discount">Discount Price (PHP)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="product-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Optional"
                  value={form.discountPrice}
                  onChange={(e) => updateField('discountPrice', e.target.value)}
                  className="flex-1"
                />
                {form.discountPrice.trim() !== '' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateField('discountPrice', '')}
                    className="shrink-0"
                  >
                    Remove discount
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank for no discount (product uses original price). Must be less than or equal to selling price.
              </p>
            </div>

            {editingProduct ? (
              <div className="space-y-4">
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
                <div className="space-y-2">
                  <Label htmlFor="product-reduce">Reduce / Remove Stock</Label>
                  <Input
                    id="product-reduce"
                    type="number"
                    min="0"
                    max={editingProduct?.stockQuantity ?? 0}
                    step="1"
                    placeholder="0"
                    value={reduceQty}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setReduceQty('');
                        return;
                      }
                      const num = parseInt(raw, 10);
                      if (Number.isNaN(num)) return;
                      const max = editingProduct?.stockQuantity ?? 0;
                      setReduceQty(String(Math.min(Math.max(0, num), max)));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use when items are withdrawn, lost, damaged, or expired. Max {editingProduct?.stockQuantity ?? 0} (current stock).
                  </p>
                </div>
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

      {/* Reduce stock dialog (from Realtime Stocks) */}
      <Dialog
        open={!!reduceDialogProduct}
        onOpenChange={(open) => {
          if (!open) setReduceDialogProduct(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reduce stock</DialogTitle>
            <DialogDescription>
              Remove or reduce quantity for <strong>{reduceDialogProduct?.name}</strong>. Use for withdrawn, lost, damaged, or expired items. Current stock: <strong>{reduceDialogProduct?.stockQuantity ?? 0}</strong>. Quantity is capped at current stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reduce-dialog-qty">Quantity to reduce</Label>
              <Input
                id="reduce-dialog-qty"
                type="number"
                min="1"
                max={reduceDialogProduct?.stockQuantity ?? 0}
                step="1"
                placeholder="0"
                value={reduceDialogQty}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    setReduceDialogQty('');
                    return;
                  }
                  const num = parseInt(raw, 10);
                  if (Number.isNaN(num)) return;
                  const max = reduceDialogProduct?.stockQuantity ?? 0;
                  setReduceDialogQty(String(Math.min(Math.max(1, num), max)));
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReduceDialogProduct(null)}>
              Cancel
            </Button>
            <Button onClick={handleReduceStockSubmit} disabled={reduceSubmitting || !reduceDialogQty.trim()}>
              {reduceSubmitting ? 'Reducing...' : 'Reduce stock'}
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
              Select which products should carry over their stock to tomorrow. Non-perishable items are checked by default; perishable items are unchecked by default. Previously saved selections are preserved.
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

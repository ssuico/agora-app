import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, AlertTriangle, Ban, Check, CheckCircle2, ChevronDown, ChevronRight, Clock, Coins, Download, FileSpreadsheet, History, ImageIcon, Info, NotepadText, Package, PackageCheck, PackageX, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';

type ClaimStatus = 'unclaimed' | 'claimed';
type PaymentStatus = 'unpaid' | 'paid' | 'partial';
type OrderStatus = 'active' | 'cancelled';
type OrderType = 'regular' | 'walk-in' | 'preorder';

interface CancellationRequest {
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  requestedAt: string;
  resolvedAt?: string | null;
  responseNote?: string | null;
}

interface Transaction {
  _id: string;
  storeId: string;
  cancellationRequest?: CancellationRequest | null;
  customerId?: { _id: string; name: string; email: string } | null;
  walkInCustomerName?: string | null;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  claimStatus: ClaimStatus;
  paymentStatus: PaymentStatus;
  amountPaid?: number;
  orderStatus: OrderStatus;
  orderType?: OrderType;
  paidAt?: string | null;
  claimedAt?: string | null;
  notes?: string | null;
  customerNotes?: string | null;
  createdAt: string;
}

interface TransactionItemDetail {
  _id: string;
  productId: { _id: string; name: string; sellingPrice: number; costPrice: number } | null;
  quantity: number;
  subtotal: number;
  costSubtotal: number;
}

interface ReportRecord {
  _id: string;
  transactionDate: string;
  fileName: string;
  generatedBy: { _id: string; name: string } | null;
  generatedAt: string;
  createdAt: string;
}

interface TransactionManagerProps {
  storeId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

/** Use EST for all transaction/report dates so they match server APP_TIMEZONE. */
const EST_TIMEZONE = 'America/New_York';
const fmtDate = (date: Date) =>
  date.toLocaleString('en-US', { timeZone: EST_TIMEZONE });

/** "Oct 6, 2026 at 3:42 PM" in the app timezone. */
const fmtGeneratedAt = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { timeZone: EST_TIMEZONE, month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { timeZone: EST_TIMEZONE, hour: 'numeric', minute: '2-digit' });
  return `${date} at ${time}`;
};

/** Today's date (YYYY-MM-DD) in EST for default date filter. */
function todayInEST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: EST_TIMEZONE });
}

const COL_COUNT = 11;

function ClaimBadge({ status }: { status: ClaimStatus }) {
  return status === 'claimed' ? (
    <Badge variant="operational">
      <Package />Claimed
    </Badge>
  ) : (
    <Badge variant="warning">
      <Clock />Unclaimed
    </Badge>
  );
}

function PaymentBadge({ status, totalAmount, amountPaid }: { status: PaymentStatus; totalAmount?: number; amountPaid?: number }) {
  if (status === 'paid') {
    return (
      <Badge variant="success">
        <CheckCircle2 />Paid
      </Badge>
    );
  }
  if (status === 'partial') {
    const label = (totalAmount != null && amountPaid != null && amountPaid > 0)
      ? `${fmt(amountPaid)} / ${fmt(totalAmount)}`
      : 'Partial';
    return (
      <Badge variant="info">
        <Coins />{label}
      </Badge>
    );
  }
  return (
    <Badge variant="error">
      <AlertTriangle />Unpaid
    </Badge>
  );
}

/** Info icon whose tooltip shows when a status was reached (hover or keyboard focus). */
function StatusDateInfo({
  label,
  date,
  active,
  emptyText,
}: {
  label: string;
  date?: string | null;
  active: boolean;
  emptyText: string;
}) {
  const text = date
    ? fmtDate(new Date(date))
    : active
      ? 'Date not recorded'
      : emptyText;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`${label}: ${text}`}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Info className="size-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="whitespace-nowrap">
          <span className="text-muted-foreground">{label}: </span>
          <span className="font-medium">{text}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function StockLabel({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-error">
        <PackageX className="size-3" />Out of stock
      </span>
    );
  }
  if (quantity < 10) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-warning">
        <AlertTriangle className="size-3" />Low · {quantity} left
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-operational">
      <PackageCheck className="size-3" />In stock · {quantity}
    </span>
  );
}

/** Selected state is carried by fill, ring, weight, and a check mark, not color alone. */
function SegmentTrigger({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsTrigger
      value={value}
      className="group/seg gap-1 data-[state=active]:bg-primary-subtle data-[state=active]:ring-1 data-[state=active]:ring-primary/60"
    >
      <Check aria-hidden="true" className="hidden size-3.5 text-primary group-data-[state=active]/seg:block" />
      {children}
    </TabsTrigger>
  );
}

/** Paid and claimed orders that are not cancelled are shown as completed. */
function getDisplayOrderStatus(tx: Pick<Transaction, 'orderStatus' | 'claimStatus' | 'paymentStatus'>): OrderStatus | 'completed' {
  if (tx.orderStatus === 'cancelled') return 'cancelled';
  return tx.claimStatus === 'claimed' && tx.paymentStatus === 'paid' ? 'completed' : 'active';
}

function OrderBadge({ status }: { status: OrderStatus | 'completed' }) {
  if (status === 'cancelled') return <Badge variant="error">Cancelled</Badge>;
  if (status === 'completed') {
    return (
      <Badge variant="success">
        <CheckCircle2 />Completed
      </Badge>
    );
  }
  return <Badge variant="secondary">Active</Badge>;
}

function OrderTypeBadge({ orderType }: { orderType?: OrderType | null }) {
  if (orderType === 'preorder') return <Badge variant="warning">PRE-ORDER</Badge>;
  if (orderType === 'walk-in') return <Badge variant="info">WALK-IN</Badge>;
  return <Badge variant="outline">REGULAR</Badge>;
}

function ProductImageThumb({ src, className }: { src?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded shrink-0 ${className}`}>
        <ImageIcon className="size-4 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className={`object-cover rounded shrink-0 ${className}`}
      onError={() => setFailed(true)}
    />
  );
}

// ---------------------------------------------------------------------------
// Report History Tab
// ---------------------------------------------------------------------------

function ReportHistory({ storeId }: { storeId: string }) {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ReportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);

  const fetchReports = async () => {
    try {
      const res = await fetch(`/api/transaction-reports?storeId=${storeId}`);
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
      const res = await fetch(`/api/transaction-reports/${reportId}/download`);
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
      const res = await fetch(`/api/transaction-reports/${deleteTarget._id}`, { method: 'DELETE' });
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
    return (
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time Generated</TableHead>
                <TableHead>Generated By</TableHead>
                <TableHead>Report Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-40" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell className="px-4 py-3"><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Skeleton className="h-7 w-24 rounded-md" />
                      <Skeleton className="h-7 w-16 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  const paginatedReports = reports.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <>
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="p-0">
        <div className="data-table-scroll-wrapper flex-1 min-h-0">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date/Time Generated</th>
                <th>Generated By</th>
                <th>Transaction Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    <Empty className="border-0 p-4 md:p-4">
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><History /></EmptyMedia>
                        <EmptyTitle>No reports generated yet</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </td>
                </tr>
              ) : (
                paginatedReports.map((r) => (
                  <tr key={r._id}>
                    <td className="whitespace-nowrap">
                      {fmtGeneratedAt(r.generatedAt ?? r.createdAt)}
                    </td>
                    <td>
                      {r.generatedBy?.name ?? <span className="text-muted-foreground italic">Unknown</span>}
                    </td>
                    <td className="font-mono text-xs">{r.transactionDate}</td>
                    <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(r._id, r.fileName)}
                      >
                        <Download data-icon="inline-start" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(r)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 data-icon="inline-start" />
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
        </CardContent>
        {reports.length > 0 && (
          <CardFooter className="block p-0">
            <TablePagination
              currentPage={page}
              totalItems={reports.length}
              onPageChange={setPage}
              label="reports"
            />
          </CardFooter>
        )}
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this report? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
              <p><span className="text-muted-foreground">Transaction Date:</span> <span className="font-mono">{deleteTarget.transactionDate}</span></p>
              <p><span className="text-muted-foreground">Generated By:</span> {deleteTarget.generatedBy?.name ?? 'Unknown'}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              {deleting ? 'Deleting...' : 'Yes, Delete Report'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main TransactionManager
// ---------------------------------------------------------------------------

export function TransactionManager({ storeId }: TransactionManagerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<Transaction | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmStatusAction, setConfirmStatusAction] = useState<{
    tx: Transaction;
    field: 'claimStatus' | 'paymentStatus';
    value: string;
  } | null>(null);
  const [executingStatusAction, setExecutingStatusAction] = useState(false);
  const [partialPaymentTarget, setPartialPaymentTarget] = useState<Transaction | null>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [partialPaymentSubmitting, setPartialPaymentSubmitting] = useState(false);

  const [filterClaim, setFilterClaim] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterOrder, setFilterOrder] = useState('all');
  const [filterOrderType, setFilterOrderType] = useState('all');
  const [filterCustomerName, setFilterCustomerName] = useState('');
  const [filterCustomerNameDebounced, setFilterCustomerNameDebounced] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [filterProducts, setFilterProducts] = useState<Array<{ _id: string; name: string }>>([]);
  const [filterDateFrom, setFilterDateFrom] = useState(() => todayInEST());
  const [filterDateTo, setFilterDateTo] = useState(() => todayInEST());
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setFilterCustomerNameDebounced(filterCustomerName), 600);
    return () => clearTimeout(t);
  }, [filterCustomerName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = todayInEST();
        const params = new URLSearchParams({ storeId, date: today });
        const res = await fetch(`/api/inventory/daily?${params}`);
        if (cancelled || !res.ok) return;
        const rows: Array<{ productId: string; productName: string }> = await res.json();
        setFilterProducts(rows.map((r) => ({ _id: r.productId, name: r.productName })));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, TransactionItemDetail[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [reportHistoryKey, setReportHistoryKey] = useState(0);
  const [existingReport, setExistingReport] = useState<ReportRecord | null>(null);

  const [newTxOpen, setNewTxOpen] = useState(false);
  const [newTxProducts, setNewTxProducts] = useState<Array<{ _id: string; name: string; sellingPrice: number; costPrice: number; stockQuantity: number; images?: string[] }>>([]);
  const [newTxCustomers, setNewTxCustomers] = useState<Array<{ _id: string; name: string; email: string; role?: string }>>([]);
  const [newTxQuantities, setNewTxQuantities] = useState<Record<string, number>>({});
  const [newTxCustomerId, setNewTxCustomerId] = useState<string>('');
  const [newTxWalkInName, setNewTxWalkInName] = useState('');
  const [newTxClaimStatus, setNewTxClaimStatus] = useState<ClaimStatus>('unclaimed');
  const [newTxPaymentStatus, setNewTxPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [newTxAmountPaid, setNewTxAmountPaid] = useState('');
  const [newTxNotes, setNewTxNotes] = useState('');
  const [newTxSubmitting, setNewTxSubmitting] = useState(false);
  const [newTxShowValidationWarning, setNewTxShowValidationWarning] = useState(false);
  const [newTxLoading, setNewTxLoading] = useState(false);
  const [newTxError, setNewTxError] = useState('');
  const [newTxSearch, setNewTxSearch] = useState('');
  const [newTxLoadKey, setNewTxLoadKey] = useState(0);
  const [notesModalTx, setNotesModalTx] = useState<Transaction | null>(null);
  const [notesEdit, setNotesEdit] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);

  const [editCustomerTx, setEditCustomerTx] = useState<Transaction | null>(null);
  const [editCustomerType, setEditCustomerType] = useState<'registered' | 'walk-in'>('walk-in');
  const [editCustomerSelectedId, setEditCustomerSelectedId] = useState('');
  const [editCustomerWalkInName, setEditCustomerWalkInName] = useState('');
  const [editCustomerSubmitting, setEditCustomerSubmitting] = useState(false);
  const [editCustomerCustomers, setEditCustomerCustomers] = useState<Array<{ _id: string; name: string; email: string; role?: string }>>([]);
  const [editCustomerLoadingList, setEditCustomerLoadingList] = useState(false);

  useEffect(() => {
    if (!newTxOpen) return;
    const controller = new AbortController();
    const { signal } = controller;
    setNewTxLoading(true);
    setNewTxError('');
    (async () => {
      try {
        const today = todayInEST();
        const dailyParams = new URLSearchParams({ storeId, date: today });
        const [productsRes, customersRes, managersRes, dailyRes] = await Promise.all([
          fetch(`/api/products?storeId=${storeId}`, { signal }),
          fetch('/api/users?role=customer', { signal }),
          fetch('/api/users?role=store_manager', { signal }),
          fetch(`/api/inventory/daily?${dailyParams}`, { signal }),
        ]);
        if (signal.aborted) return;

        let dailyIds: Set<string> | null = null;
        if (dailyRes.ok) {
          const rows: Array<{ productId: string }> = await dailyRes.json();
          dailyIds = new Set(rows.map((r) => r.productId));
        }

        if (productsRes.ok) {
          let list = await productsRes.json();
          if (dailyIds) {
            list = list.filter((p: { _id: string }) => dailyIds!.has(p._id));
          }
          setNewTxProducts(list);
          setNewTxQuantities((prev) => {
            const next = { ...prev };
            for (const p of list) {
              if (next[p._id] === undefined) next[p._id] = 0;
            }
            return next;
          });
        } else {
          setNewTxError('Failed to load products');
        }
        {
          const customers: Array<{ _id: string; name: string; email: string; role?: string }> =
            customersRes.ok ? await customersRes.json() : [];
          const managers: Array<{ _id: string; name: string; email: string; role?: string }> =
            managersRes.ok ? await managersRes.json() : [];
          const seen = new Set<string>();
          const merged: typeof customers = [];
          for (const u of [...customers, ...managers]) {
            if (!seen.has(u._id)) {
              seen.add(u._id);
              merged.push(u);
            }
          }
          setNewTxCustomers(
            merged.sort((a, b) =>
              (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
            )
          );
        }
      } catch (e) {
        if (!signal.aborted) {
          setNewTxError(e instanceof Error ? e.message : 'Failed to load modal data');
        }
      } finally {
        if (!signal.aborted) setNewTxLoading(false);
      }
    })();
    return () => controller.abort();
  }, [newTxOpen, storeId, newTxLoadKey]);

  const setNewTxQty = (productId: string, delta: number) => {
    setNewTxQuantities((prev) => {
      const current = prev[productId] ?? 0;
      const product = newTxProducts.find((p) => p._id === productId);
      const max = product ? product.stockQuantity : 0;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [productId]: next };
    });
  };

  const handleCreateTransaction = async () => {
    const items = Object.entries(newTxQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    const hasCustomer = !!newTxCustomerId || (newTxWalkInName && newTxWalkInName.trim().length > 0);
    if (items.length === 0) {
      setNewTxShowValidationWarning(true);
      toast.error('Add at least one product with quantity before creating the transaction.');
      return;
    }
    if (!hasCustomer) {
      setNewTxShowValidationWarning(true);
      toast.error('Add a customer (select from list or enter walk-in name) before creating the transaction.');
      return;
    }
    setNewTxSubmitting(true);
    try {
      const body: {
        storeId: string;
        items: Array<{ productId: string; quantity: number }>;
        customerId?: string;
        walkInCustomerName?: string;
        claimStatus: ClaimStatus;
        paymentStatus: PaymentStatus;
        amountPaid?: number;
        notes?: string;
      } = {
        storeId,
        items,
        claimStatus: newTxClaimStatus,
        paymentStatus: newTxPaymentStatus,
      };
      if (newTxPaymentStatus === 'partial') {
        const amount = parseFloat(newTxAmountPaid);
        if (Number.isFinite(amount) && amount > 0) body.amountPaid = amount;
      }
      if (newTxNotes.trim()) body.notes = newTxNotes.trim();
      if (newTxCustomerId) {
        body.customerId = newTxCustomerId;
      } else if (newTxWalkInName.trim()) {
        body.walkInCustomerName = newTxWalkInName.trim();
      }
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success('Transaction created');
        setNewTxShowValidationWarning(false);
        setNewTxOpen(false);
        setNewTxQuantities({});
        setNewTxCustomerId('');
        setNewTxWalkInName('');
        setNewTxClaimStatus('unclaimed');
        setNewTxPaymentStatus('unpaid');
        setNewTxAmountPaid('');
        setNewTxNotes('');
        setNewTxSearch('');
        fetchTransactions();
      } else {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to create transaction');
      }
    } catch {
      toast.error('Failed to create transaction');
    } finally {
      setNewTxSubmitting(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({ storeId });
      if (filterClaim !== 'all') params.set('claimStatus', filterClaim);
      if (filterPayment !== 'all') params.set('paymentStatus', filterPayment);
      if (filterOrder !== 'all') params.set('orderStatus', filterOrder);
      if (filterOrderType !== 'all') params.set('orderType', filterOrderType);
      if (filterCustomerNameDebounced.trim()) params.set('customerName', filterCustomerNameDebounced.trim());
      if (filterProductId) params.set('productId', filterProductId);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) setTransactions(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const fetchItems = async (txId: string) => {
    if (itemsCache[txId]) return;
    setItemsLoading(txId);
    try {
      const res = await fetch(`/api/transactions/${txId}`);
      if (res.ok) {
        const data = await res.json();
        setItemsCache((prev) => ({ ...prev, [txId]: data.items }));
      }
    } catch { /* ignore */ } finally {
      setItemsLoading(null);
    }
  };

  const toggleExpand = (txId: string) => {
    if (expandedId === txId) {
      setExpandedId(null);
    } else {
      setExpandedId(txId);
      fetchItems(txId);
    }
  };

  useEffect(() => {
    setPage(1);
    const isInitialLoad = transactions.length === 0;
    if (isInitialLoad) setLoading(true);
    fetchTransactions();
  }, [filterClaim, filterPayment, filterOrder, filterOrderType, filterCustomerNameDebounced, filterProductId, filterDateFrom, filterDateTo]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:store', storeId);

    const handleCreated = (tx: Transaction) => {
      setTransactions((prev) => {
        if (prev.some((t) => t._id === tx._id)) return prev;
        return [tx, ...prev];
      });
    };

    const handleUpdated = (tx: Transaction) => {
      setTransactions((prev) =>
        prev.map((t) => (t._id === tx._id ? { ...t, ...tx } : t))
      );
    };

    const handleCancelRequested = (payload: { transactionId: string; totalAmount: number }) => {
      toast(`A customer asked to cancel order ${payload.transactionId.slice(-8)} (${fmt(payload.totalAmount)}).`, {
        icon: '⚠️',
      });
    };

    socket.on('transaction:created', handleCreated);
    socket.on('transaction:updated', handleUpdated);
    socket.on('transaction:cancel-requested', handleCancelRequested);

    return () => {
      socket.off('transaction:created', handleCreated);
      socket.off('transaction:updated', handleUpdated);
      socket.off('transaction:cancel-requested', handleCancelRequested);
      socket.emit('leave:store', storeId);
    };
  }, [storeId]);

  const updateStatus = async (
    txId: string,
    field: 'claimStatus' | 'paymentStatus',
    value: string,
    extraBody?: Record<string, unknown>
  ) => {
    setUpdating(txId);
    try {
      const body = { [field]: value, ...extraBody };
      const res = await fetch(`/api/transactions/${txId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated: Transaction = await res.json();
        setTransactions((prev) =>
          prev.map((tx) => (tx._id === txId ? { ...tx, ...updated } : tx))
        );
        toast.success('Status updated');
      } else {
        toast.error('Failed to update status');
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const handleConfirmStatusAction = async () => {
    if (!confirmStatusAction) return;
    setExecutingStatusAction(true);
    try {
      await updateStatus(confirmStatusAction.tx._id, confirmStatusAction.field, confirmStatusAction.value);
      setConfirmStatusAction(null);
    } finally {
      setExecutingStatusAction(false);
    }
  };

  const openPartialPaymentDialog = (tx: Transaction) => {
    setPartialPaymentTarget(tx);
    setPartialPaymentAmount(String(tx.amountPaid ?? 0));
  };

  const handlePartialPaymentSubmit = async () => {
    if (!partialPaymentTarget) return;
    const amount = parseFloat(partialPaymentAmount);
    if (!Number.isFinite(amount) || amount < 0 || amount >= partialPaymentTarget.totalAmount) {
      toast.error('Enter an amount paid greater than 0 and less than the order total.');
      return;
    }
    setPartialPaymentSubmitting(true);
    try {
      await updateStatus(partialPaymentTarget._id, 'paymentStatus', 'partial', { amountPaid: amount });
      setPartialPaymentTarget(null);
      setPartialPaymentAmount('');
    } finally {
      setPartialPaymentSubmitting(false);
    }
  };

  useEffect(() => {
    if (notesModalTx) setNotesEdit(notesModalTx.notes ?? '');
    else setNotesEdit('');
  }, [notesModalTx]);

  const openEditCustomer = (tx: Transaction) => {
    setEditCustomerTx(tx);
    if (tx.customerId && typeof tx.customerId === 'object') {
      setEditCustomerType('registered');
      setEditCustomerSelectedId(tx.customerId._id);
      setEditCustomerWalkInName('');
    } else {
      setEditCustomerType('walk-in');
      setEditCustomerSelectedId('');
      setEditCustomerWalkInName(tx.walkInCustomerName ?? '');
    }
  };

  useEffect(() => {
    if (!editCustomerTx) return;
    if (editCustomerCustomers.length > 0) return;
    setEditCustomerLoadingList(true);
    (async () => {
      try {
        const [customersRes, managersRes] = await Promise.all([
          fetch('/api/users?role=customer'),
          fetch('/api/users?role=store_manager'),
        ]);
        const customers: Array<{ _id: string; name: string; email: string; role?: string }> =
          customersRes.ok ? await customersRes.json() : [];
        const managers: Array<{ _id: string; name: string; email: string; role?: string }> =
          managersRes.ok ? await managersRes.json() : [];
        const seen = new Set<string>();
        const merged: typeof customers = [];
        for (const u of [...customers, ...managers]) {
          if (!seen.has(u._id)) { seen.add(u._id); merged.push(u); }
        }
        setEditCustomerCustomers(
          merged.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
        );
      } catch { /* ignore */ } finally {
        setEditCustomerLoadingList(false);
      }
    })();
  }, [editCustomerTx]);

  const handleSaveEditCustomer = async () => {
    if (!editCustomerTx) return;
    setEditCustomerSubmitting(true);
    try {
      const body =
        editCustomerType === 'registered' && editCustomerSelectedId
          ? { customerId: editCustomerSelectedId, walkInCustomerName: null }
          : { customerId: null, walkInCustomerName: editCustomerWalkInName.trim() || null };

      const res = await fetch(`/api/transactions/${editCustomerTx._id}/customer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated: Transaction = await res.json();
        setTransactions((prev) =>
          prev.map((tx) => (tx._id === updated._id ? { ...tx, ...updated } : tx))
        );
        setEditCustomerTx(null);
        toast.success('Customer updated');
      } else {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to update customer');
      }
    } catch {
      toast.error('Failed to update customer');
    } finally {
      setEditCustomerSubmitting(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesModalTx) return;
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/transactions/${notesModalTx._id}/notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesEdit.trim() || null }),
      });
      if (res.ok) {
        const updated: Transaction = await res.json();
        setTransactions((prev) =>
          prev.map((tx) => (tx._id === updated._id ? { ...tx, ...updated } : tx))
        );
        setNotesModalTx((prev) => (prev ? { ...prev, notes: updated.notes ?? null } : null));
        toast.success('Notes saved');
      } else {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to save notes');
      }
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/transactions/${cancelTarget._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const updated: Transaction = await res.json();
        setTransactions((prev) =>
          prev.map((tx) => (tx._id === updated._id ? { ...tx, ...updated } : tx))
        );
        toast.success('Order cancelled');
      } else {
        toast.error('Failed to cancel order');
      }
    } catch {
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const closeReviewDialog = () => {
    if (reviewSubmitting) return;
    setReviewTarget(null);
    setReviewNote('');
  };

  const handleResolveRequest = async (decision: 'approve' | 'reject') => {
    if (!reviewTarget) return;
    setReviewSubmitting(decision);
    try {
      const res = await fetch(`/api/transactions/${reviewTarget._id}/cancel-request`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note: decision === 'reject' ? reviewNote.trim() : undefined }),
      });
      if (res.ok) {
        const updated: Transaction = await res.json();
        setTransactions((prev) =>
          prev.map((tx) => (tx._id === updated._id ? { ...tx, ...updated } : tx))
        );
        toast.success(decision === 'approve' ? 'Request approved. Order cancelled.' : 'Request declined.');
        setReviewTarget(null);
        setReviewNote('');
      } else {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to update the request');
      }
    } catch {
      toast.error('Failed to update the request');
    } finally {
      setReviewSubmitting(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/transactions/${deleteTarget._id}`, { method: 'DELETE' });
      if (res.ok) {
        setTransactions((prev) => prev.filter((tx) => tx._id !== deleteTarget._id));
        toast.success('Transaction deleted');
      } else {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to delete transaction');
      }
    } catch {
      toast.error('Failed to delete transaction');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleGenerateReport = async (overwrite = false) => {
    setGenerating(true);
    try {
      const params = new URLSearchParams({ storeId });
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (overwrite) params.set('overwrite', 'true');
      const res = await fetch(`/api/transaction-reports/generate?${params}`, {
        method: 'POST',
      });
      if (res.ok) {
        setReportHistoryKey((k) => k + 1);
        toast.success(overwrite ? 'Report updated' : 'Report generated');
      } else if (res.status === 409) {
        const data = (await res.json()) as { code?: string; report?: ReportRecord };
        if (data.code === 'REPORT_EXISTS' && data.report) {
          setExistingReport(data.report);
        } else {
          toast.error('Failed to generate report');
        }
      } else {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(data.message ?? 'Failed to generate report');
      }
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleConfirmUpdateReport = async () => {
    setExistingReport(null);
    await handleGenerateReport(true);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Reservations and sales history</p>
        </div>
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="p-0">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="px-4 py-3"><Skeleton className="size-4" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="px-4 py-3"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Skeleton className="size-7 rounded-md" />
                        <Skeleton className="size-7 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">Manage reservations, claiming, and payment statuses</p>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">
            <FileSpreadsheet />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="report-history">
            <History />
            Report History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="flex flex-col gap-4">
          {/* Filters + Generate button */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Claim:</Label>
              <Select value={filterClaim} onValueChange={setFilterClaim}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unclaimed">Unclaimed</SelectItem>
                    <SelectItem value="claimed">Claimed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Payment:</Label>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Order:</Label>
              <Select value={filterOrder} onValueChange={setFilterOrder}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancel-requested">Cancel requested</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Type:</Label>
              <Select value={filterOrderType} onValueChange={setFilterOrderType}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="walk-in">Walk-in</SelectItem>
                    <SelectItem value="preorder">Pre-Order</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Customer:</Label>
              <Input
                placeholder="Search by name..."
                value={filterCustomerName}
                onChange={(e) => setFilterCustomerName(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Product:</Label>
              <Select value={filterProductId || 'all'} onValueChange={(v) => setFilterProductId(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="All products" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All products</SelectItem>
                    {filterProducts.map((p) => (
                      <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Date:</Label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-36"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-36"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = todayInEST();
                setFilterClaim('all');
                setFilterPayment('all');
                setFilterOrder('all');
                setFilterOrderType('all');
                setFilterCustomerName('');
                setFilterCustomerNameDebounced('');
                setFilterProductId('');
                setFilterDateFrom(today);
                setFilterDateTo(today);
              }}
              className="text-muted-foreground"
            >
              Clear filters
            </Button>

            <Button
                variant="default"
                size="sm"
                onClick={() => setNewTxOpen(true)}
              >
                <Plus data-icon="inline-start" />
                New Transaction
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerateReport()}
                disabled={generating}
              >
                {generating ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FileSpreadsheet data-icon="inline-start" />
                )}
                {generating ? 'Generating...' : 'Generate Report'}
              </Button>

            <div className="ml-auto flex items-center gap-4">
              {(() => {
                const active = transactions.filter((tx) => tx.orderStatus !== 'cancelled');
                const totalPaid = active.filter((tx) => tx.paymentStatus === 'paid').reduce((s, tx) => s + tx.totalAmount, 0);
                const totalUnpaid = active.filter((tx) => tx.paymentStatus === 'unpaid').reduce((s, tx) => s + tx.totalAmount, 0);
                const partialTxs = active.filter((tx) => tx.paymentStatus === 'partial');
                const partialPaid = partialTxs.reduce((s, tx) => s + (tx.amountPaid ?? 0), 0);
                const partialRemaining = partialTxs.reduce((s, tx) => s + (tx.totalAmount - (tx.amountPaid ?? 0)), 0);
                return (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Paid: <span className="font-medium text-success">{fmt(totalPaid)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Unpaid: <span className="font-medium text-warning">{fmt(totalUnpaid)}</span>
                    </span>
                    {partialTxs.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Partial: <span className="font-medium text-info">{fmt(partialPaid)}</span> paid, <span className="font-medium text-foreground">{fmt(partialRemaining)}</span> remaining
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Table */}
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="p-0">
            <div className="data-table-scroll-wrapper flex-1 min-h-0">
              <table className="data-table transactions-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th className="w-8 px-2" />
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Amount</th>
                    <th>Profit</th>
                    <th>Claiming</th>
                    <th>Payment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-muted-foreground">
                        <Empty className="border-0 p-4 md:p-4">
                          <EmptyHeader>
                            <EmptyMedia variant="icon"><FileSpreadsheet /></EmptyMedia>
                            <EmptyTitle>No transactions found</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      </td>
                    </tr>
                  ) : (
                    transactions
                      .slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
                      .map((tx) => {
                    const isUpdating = updating === tx._id;
                    const isCancelled = tx.orderStatus === 'cancelled';
                    const isExpanded = expandedId === tx._id;
                    const items = itemsCache[tx._id];
                    const isLoadingItems = itemsLoading === tx._id;
                    const itemCount = items ? items.reduce((s, i) => s + i.quantity, 0) : null;

                    return (
                      <TransactionRow
                        key={tx._id}
                        tx={tx}
                        isUpdating={isUpdating}
                        isCancelled={isCancelled}
                        isExpanded={isExpanded}
                        items={items}
                        itemCount={itemCount}
                        isLoadingItems={isLoadingItems}
                        onToggleExpand={() => toggleExpand(tx._id)}
                        onRequestStatusChange={(tx, field, value) => setConfirmStatusAction({ tx, field, value })}
                        onRequestPartialPayment={openPartialPaymentDialog}
                        onViewNotes={() => setNotesModalTx(tx)}
                        onEditCustomer={() => openEditCustomer(tx)}
                        onCancelClick={() => setCancelTarget(tx)}
                        onReviewCancelRequest={() => { setReviewTarget(tx); setReviewNote(''); }}
                        onDeleteClick={() => setDeleteTarget(tx)}
                      />
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
            </CardContent>
            {transactions.length > 0 && (
              <CardFooter className="block p-0">
                <TablePagination
                  currentPage={page}
                  totalItems={transactions.length}
                  onPageChange={setPage}
                  label="transactions"
                />
              </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="report-history" className="flex flex-col gap-4">
          <ReportHistory key={reportHistoryKey} storeId={storeId} />
        </TabsContent>
      </Tabs>

      {/* New Transaction modal */}
      <Dialog open={newTxOpen} onOpenChange={(open) => { setNewTxOpen(open); if (!open) setNewTxShowValidationWarning(false); }}>
        <DialogContent className="flex flex-col gap-4 p-6 w-[80vw]! max-w-[80vw]! h-[88vh]! max-h-[88vh]! overflow-hidden">
          <DialogHeader>
            <DialogTitle>New Transaction</DialogTitle>
            <DialogDescription>
              Add products, set customer, and choose claim/payment status.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <div className="flex items-center justify-between gap-3 shrink-0">
                <Label className="text-sm font-medium">Products</Label>
                <div className="relative w-52">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search products..."
                    value={newTxSearch}
                    onChange={(e) => setNewTxSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="border rounded-md overflow-y-auto flex-1 min-h-[200px] p-2 bg-muted/30">
                {newTxLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 p-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="gap-2 p-2">
                        <CardContent className="flex flex-col gap-2 p-0">
                          <Skeleton className="aspect-square w-full rounded-md" />
                          <Skeleton className="h-3.5 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : newTxError ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <Alert variant="destructive" className="w-auto max-w-sm">
                      <AlertCircle />
                      <AlertDescription>{newTxError}</AlertDescription>
                    </Alert>
                    <Button variant="outline" size="sm" onClick={() => setNewTxLoadKey((k) => k + 1)}>
                      Retry
                    </Button>
                  </div>
                ) : newTxProducts.length === 0 ? (
                  <Empty className="border-0 p-4 md:p-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Package /></EmptyMedia>
                      <EmptyTitle>No products in this store.</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <>{(() => {
                    const filtered = [...newTxProducts]
                      .filter((p) =>
                        !newTxSearch.trim() ||
                        p.name.toLowerCase().includes(newTxSearch.trim().toLowerCase())
                      )
                      .sort((a, b) => {
                        const aInStock = a.stockQuantity > 0 ? 0 : 1;
                        const bInStock = b.stockQuantity > 0 ? 0 : 1;
                        if (aInStock !== bInStock) return aInStock - bInStock;
                        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                      });
                    if (filtered.length === 0) {
                      return (
                        <Empty className="border-0 p-4 md:p-4">
                          <EmptyHeader>
                            <EmptyMedia variant="icon"><Search /></EmptyMedia>
                            <EmptyTitle>No products match &ldquo;{newTxSearch}&rdquo;.</EmptyTitle>
                          </EmptyHeader>
                        </Empty>
                      );
                    }
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {filtered.map((p) => {
                          const qty = newTxQuantities[p._id] ?? 0;
                          return (
                            <Card key={p._id} className={`p-2 flex flex-col gap-1.5 ${qty > 0 ? 'border-primary/60 bg-primary-subtle/30' : ''}`}>
                              <CardContent className="p-0 flex gap-2">
                                <div className="flex flex-1 min-w-0 flex-col gap-1">
                                  <p className="text-xs font-semibold leading-tight line-clamp-2">{p.name}</p>
                                  <p className="text-xs font-medium text-foreground">{fmt(p.sellingPrice)}</p>
                                  <StockLabel quantity={p.stockQuantity} />
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="size-7 shrink-0"
                                      aria-label={`Remove one ${p.name}`}
                                      onClick={() => setNewTxQty(p._id, -1)}
                                      disabled={qty <= 0}
                                    >
                                      −
                                    </Button>
                                    <span className="text-xs font-semibold text-foreground min-w-6 text-center">{qty}</span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="size-7 shrink-0 border-primary/40 text-primary hover:bg-primary-subtle/60 hover:text-primary"
                                      aria-label={`Add one ${p.name}`}
                                      onClick={() => setNewTxQty(p._id, 1)}
                                      disabled={qty >= p.stockQuantity}
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                                <ProductImageThumb
                                  src={p.images?.[0]}
                                  className="size-16 rounded border border-border shrink-0"
                                />
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })()}</>
                )}
              </div>
              {(() => {
                const total = newTxProducts.reduce(
                  (sum, p) => sum + (newTxQuantities[p._id] ?? 0) * p.sellingPrice,
                  0
                );
                if (total <= 0) return null;
                const itemCount = Object.values(newTxQuantities).reduce((a, b) => a + b, 0);
                return (
                  <div className="flex shrink-0 items-center justify-between rounded-md border bg-muted px-3 py-2">
                    <span className="text-sm text-muted-foreground">
                      {itemCount} item{itemCount !== 1 ? 's' : ''} selected
                    </span>
                    <span className="text-base font-bold text-foreground">
                      Total: {fmt(total)}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Customer</Label>
                <Select value={newTxCustomerId || 'walk-in'} onValueChange={(v) => setNewTxCustomerId(v === 'walk-in' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Walk-in" /></SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="walk-in">Walk-in (enter name below)</SelectItem>
                      {newTxCustomers.map((c) => (
                        <SelectItem key={c._id} value={c._id}>
                          {c.name} {c.email ? `(${c.email})` : ''}
                          {c.role === 'store_manager' && <span className="ml-1 text-muted-foreground text-xs">[Store Manager]</span>}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {(!newTxCustomerId || newTxCustomerId === '') && (
                  <Input
                    placeholder="Customer name (optional)"
                    value={newTxWalkInName}
                    onChange={(e) => setNewTxWalkInName(e.target.value)}
                    className="mt-1"
                  />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Claim / Payment</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Claim</span>
                    <Tabs value={newTxClaimStatus} onValueChange={(v) => setNewTxClaimStatus(v as ClaimStatus)}>
                      <TabsList className="w-full">
                        <SegmentTrigger value="unclaimed">Unclaimed</SegmentTrigger>
                        <SegmentTrigger value="claimed">Claimed</SegmentTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-muted-foreground">Payment</span>
                    <Tabs value={newTxPaymentStatus} onValueChange={(v) => setNewTxPaymentStatus(v as PaymentStatus)}>
                      <TabsList className="w-full">
                        <SegmentTrigger value="unpaid">Unpaid</SegmentTrigger>
                        <SegmentTrigger value="partial">Partial</SegmentTrigger>
                        <SegmentTrigger value="paid">Paid</SegmentTrigger>
                      </TabsList>
                    </Tabs>
                    {newTxPaymentStatus === 'partial' && (
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="new-tx-amount-paid" className="text-xs">Amount paid (PHP)</Label>
                        <Input
                          id="new-tx-amount-paid"
                          type="number"
                          min="0"
                          step="0.01"
                          value={newTxAmountPaid}
                          onChange={(e) => setNewTxAmountPaid(e.target.value)}
                          placeholder="0"
                          className="h-8"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-tx-notes" className="text-sm font-medium">Notes (optional)</Label>
                <Textarea
                  id="new-tx-notes"
                  className="min-h-20"
                  placeholder="Add any notes for this transaction..."
                  value={newTxNotes}
                  onChange={(e) => setNewTxNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {newTxShowValidationWarning && (() => {
            const itemCount = Object.values(newTxQuantities).reduce((a, b) => a + b, 0);
            const hasCustomer = !!newTxCustomerId || (newTxWalkInName && newTxWalkInName.trim().length > 0);
            const missing = [];
            if (itemCount === 0) missing.push('at least one product with quantity');
            if (!hasCustomer) missing.push('customer name (select or enter walk-in)');
            if (missing.length === 0) return null;
            return (
              <Alert variant="warning">
                <AlertTriangle />
                <AlertDescription>Please add {missing.join(' and ')} before creating the transaction.</AlertDescription>
              </Alert>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTxOpen(false)} disabled={newTxSubmitting}>Cancel</Button>
            <Button onClick={handleCreateTransaction} disabled={newTxSubmitting}>
              {newTxSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {newTxSubmitting ? 'Creating...' : 'Create Transaction'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Existing report confirmation dialog */}
      <AlertDialog open={!!existingReport} onOpenChange={(open) => { if (!open) setExistingReport(null); }}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Report Already Exists</AlertDialogTitle>
            <AlertDialogDescription>
              {existingReport?.transactionDate === todayInEST()
                ? "You already generated today's report."
                : `You already generated a report for ${existingReport?.transactionDate.replace('_to_', ' to ')}.`}{' '}
              Do you want to update it with the latest transactions?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {existingReport && (
            <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
              <p><span className="text-muted-foreground">Report Date:</span> <span className="font-mono">{existingReport.transactionDate}</span></p>
              <p><span className="text-muted-foreground">Generated:</span> {fmtGeneratedAt(existingReport.generatedAt ?? existingReport.createdAt)}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Existing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmUpdateReport}>Update Report</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this order? The reserved items will be returned to stock.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelTarget && (
            <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
              <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{cancelTarget._id.slice(-8)}</span></p>
              <p><span className="text-muted-foreground">Customer:</span> {cancelTarget.customerId && typeof cancelTarget.customerId === 'object' ? cancelTarget.customerId.name : (cancelTarget.walkInCustomerName || 'Walk-in')}</p>
              <p><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{fmt(cancelTarget.totalAmount)}</span></p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep Order</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelling}
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
            >
              {cancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Customer cancellation request review dialog */}
      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open) closeReviewDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancellation request</DialogTitle>
            <DialogDescription>
              The customer asked to cancel this order. Approving cancels it and returns reserved items to stock.
            </DialogDescription>
          </DialogHeader>
          {reviewTarget && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
                <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{reviewTarget._id.slice(-8)}</span></p>
                <p><span className="text-muted-foreground">Customer:</span> {reviewTarget.customerId && typeof reviewTarget.customerId === 'object' ? reviewTarget.customerId.name : (reviewTarget.walkInCustomerName || 'Walk-in')}</p>
                <p><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{fmt(reviewTarget.totalAmount)}</span></p>
                {reviewTarget.cancellationRequest?.requestedAt && (
                  <p><span className="text-muted-foreground">Requested:</span> {fmtDate(new Date(reviewTarget.cancellationRequest.requestedAt))}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Customer&apos;s reason</p>
                <p className="wrap-break-word rounded-md bg-muted/40 px-3 py-2 text-sm">
                  {reviewTarget.cancellationRequest?.reason}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review-note" className="text-xs">Message to customer if declining (optional)</Label>
                <Textarea
                  id="review-note"
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="e.g. Your order is already being prepared."
                  maxLength={500}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeReviewDialog} disabled={!!reviewSubmitting}>Close</Button>
            <Button variant="outline" onClick={() => handleResolveRequest('reject')} disabled={!!reviewSubmitting}>
              {reviewSubmitting === 'reject' && <Spinner data-icon="inline-start" />}
              Decline
            </Button>
            <Button variant="destructive" onClick={() => handleResolveRequest('approve')} disabled={!!reviewSubmitting}>
              {reviewSubmitting === 'approve' && <Spinner data-icon="inline-start" />}
              Approve &amp; cancel order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="data-[size=default]:sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete this transaction? If it was not cancelled, product stock will be restored. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
              <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{deleteTarget._id.slice(-8)}</span></p>
              <p><span className="text-muted-foreground">Customer:</span> {deleteTarget.customerId && typeof deleteTarget.customerId === 'object' ? deleteTarget.customerId.name : (deleteTarget.walkInCustomerName || 'Walk-in')}</p>
              <p><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{fmt(deleteTarget.totalAmount)}</span></p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit customer dialog */}
      <Dialog open={!!editCustomerTx} onOpenChange={(open) => { if (!open) setEditCustomerTx(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Change the customer linked to this transaction.
            </DialogDescription>
          </DialogHeader>
          {editCustomerTx && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
                <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{editCustomerTx._id.slice(-8)}</span></p>
                <p><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{fmt(editCustomerTx.totalAmount)}</span></p>
              </div>

              {/* Toggle: registered vs walk-in */}
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Customer type</Label>
                <Tabs value={editCustomerType} onValueChange={(v) => setEditCustomerType(v as 'registered' | 'walk-in')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="registered">Registered</TabsTrigger>
                    <TabsTrigger value="walk-in">Walk-in</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {editCustomerType === 'registered' ? (
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Select customer</Label>
                  {editCustomerLoadingList ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Spinner /> Loading customers...
                    </div>
                  ) : (
                    <Select value={editCustomerSelectedId} onValueChange={setEditCustomerSelectedId}>
                      <SelectTrigger><SelectValue placeholder="Select a customer..." /></SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {editCustomerCustomers.map((c) => (
                            <SelectItem key={c._id} value={c._id}>
                              {c.name}{c.email ? ` (${c.email})` : ''}
                              {c.role === 'store_manager' && <span className="ml-1 text-muted-foreground text-xs"> [Manager]</span>}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-customer-walk-in-name" className="text-sm font-medium">Customer name</Label>
                  <Input
                    id="edit-customer-walk-in-name"
                    placeholder="e.g. Juan dela Cruz"
                    value={editCustomerWalkInName}
                    onChange={(e) => setEditCustomerWalkInName(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCustomerTx(null)} disabled={editCustomerSubmitting}>Cancel</Button>
            <Button
              onClick={handleSaveEditCustomer}
              disabled={
                editCustomerSubmitting ||
                (editCustomerType === 'registered' && !editCustomerSelectedId)
              }
            >
              {editCustomerSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {editCustomerSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction notes modal */}
      <Dialog open={!!notesModalTx} onOpenChange={(open) => { if (!open) setNotesModalTx(null); }}>
        <DialogContent className="w-[50vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction notes</DialogTitle>
            <DialogDescription>
              View and edit store notes. Customer reservation notes are from the customer when they placed the order.
            </DialogDescription>
          </DialogHeader>
          {notesModalTx && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
                <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{notesModalTx._id.slice(-8)}</span></p>
                <p><span className="text-muted-foreground">Customer:</span> {notesModalTx.customerId && typeof notesModalTx.customerId === 'object' ? notesModalTx.customerId.name : (notesModalTx.walkInCustomerName || 'Walk-in')}</p>
                <p><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{fmt(notesModalTx.totalAmount)}</span></p>
                <p><span className="text-muted-foreground">Date:</span> {fmtDate(new Date(notesModalTx.createdAt))}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-sm text-muted-foreground">Customer reservation notes</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm min-h-[60px] whitespace-pre-wrap">
                  {notesModalTx.customerNotes?.trim() || <span className="text-muted-foreground italic">No notes from customer.</span>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="notes-edit" className="text-sm text-muted-foreground">Store notes (editable)</Label>
                <Textarea
                  id="notes-edit"
                  className="min-h-25"
                  placeholder="Add or edit notes for this transaction..."
                  value={notesEdit}
                  onChange={(e) => setNotesEdit(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesModalTx(null)}>Close</Button>
            <Button onClick={handleSaveNotes} disabled={notesSaving || !notesModalTx}>
              {notesSaving ? <Spinner data-icon="inline-start" /> : null}
              {notesSaving ? 'Saving...' : 'Save notes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status action confirmation (Claim / Unclaim / Pay / Unpay) */}
      <Dialog open={!!confirmStatusAction} onOpenChange={(open) => { if (!open) setConfirmStatusAction(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm action</DialogTitle>
            <DialogDescription>
              {confirmStatusAction && (() => {
                const { field, value } = confirmStatusAction;
                if (field === 'claimStatus') return value === 'claimed' ? 'Are you sure you want to mark this order as claimed?' : 'Are you sure you want to revert this order to unclaimed?';
                if (field === 'paymentStatus') return value === 'paid' ? 'Are you sure you want to mark this order as paid?' : value === 'unpaid' ? 'Are you sure you want to revert this order to unpaid?' : '';
                return 'Are you sure you want to perform this action?';
              })()}
            </DialogDescription>
          </DialogHeader>
          {confirmStatusAction && (
            <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
              <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{confirmStatusAction.tx._id.slice(-8)}</span></p>
              <p><span className="text-muted-foreground">Customer:</span> {confirmStatusAction.tx.customerId && typeof confirmStatusAction.tx.customerId === 'object' ? confirmStatusAction.tx.customerId.name : (confirmStatusAction.tx.walkInCustomerName || 'Walk-in')}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStatusAction(null)} disabled={executingStatusAction}>Cancel</Button>
            <Button onClick={handleConfirmStatusAction} disabled={executingStatusAction}>
              {executingStatusAction ? <Spinner data-icon="inline-start" /> : null}
              {executingStatusAction ? 'Updating...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Partial payment dialog */}
      <Dialog open={!!partialPaymentTarget} onOpenChange={(open) => { if (!open) { setPartialPaymentTarget(null); setPartialPaymentAmount(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set partial payment</DialogTitle>
            <DialogDescription>
              Enter the amount already paid for this order. The remaining balance will stay as unpaid.
            </DialogDescription>
          </DialogHeader>
          {partialPaymentTarget && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1 rounded-md border px-4 py-3 text-sm">
                <p><span className="text-muted-foreground">Order total:</span> <span className="font-medium">{fmt(partialPaymentTarget.totalAmount)}</span></p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="partial-amount">Amount paid (PHP)</Label>
                <Input
                  id="partial-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  max={partialPaymentTarget.totalAmount - 0.01}
                  value={partialPaymentAmount}
                  onChange={(e) => setPartialPaymentAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPartialPaymentTarget(null); setPartialPaymentAmount(''); }} disabled={partialPaymentSubmitting}>Cancel</Button>
            <Button onClick={handlePartialPaymentSubmit} disabled={partialPaymentSubmitting || !partialPaymentAmount.trim()}>
              {partialPaymentSubmitting ? <Spinner data-icon="inline-start" /> : null}
              {partialPaymentSubmitting ? 'Saving...' : 'Save partial payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transaction row with expandable item breakdown
// ---------------------------------------------------------------------------

function TransactionRow({
  tx,
  isUpdating,
  isCancelled,
  isExpanded,
  items,
  itemCount,
  isLoadingItems,
  onToggleExpand,
  onRequestStatusChange,
  onRequestPartialPayment,
  onViewNotes,
  onEditCustomer,
  onCancelClick,
  onReviewCancelRequest,
  onDeleteClick,
}: {
  tx: Transaction;
  isUpdating: boolean;
  isCancelled: boolean;
  isExpanded: boolean;
  items: TransactionItemDetail[] | undefined;
  itemCount: number | null;
  isLoadingItems: boolean;
  onToggleExpand: () => void;
  onRequestStatusChange: (tx: Transaction, field: 'claimStatus' | 'paymentStatus', value: string) => void;
  onRequestPartialPayment?: (tx: Transaction) => void;
  onViewNotes?: (tx: Transaction) => void;
  onEditCustomer?: () => void;
  onCancelClick: () => void;
  onReviewCancelRequest: () => void;
  onDeleteClick: () => void;
}) {
  const hasPendingCancelRequest = !isCancelled && tx.cancellationRequest?.status === 'pending';
  return (
    <>
      <tr className={isCancelled ? 'row-muted' : undefined}>
        <td className="px-4 py-3">
          <div className="flex flex-col items-start gap-1">
            <OrderBadge status={getDisplayOrderStatus(tx)} />
            <OrderTypeBadge orderType={tx.orderType} />
            {hasPendingCancelRequest && <Badge variant="warning">Cancel requested</Badge>}
          </div>
        </td>
        {/* Expand toggle */}
        <td className="px-2 py-3">
          <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={onToggleExpand} title="View items">
            {isLoadingItems ? (
              <Spinner />
            ) : isExpanded ? (
              <ChevronDown />
            ) : (
              <ChevronRight />
            )}
          </Button>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tx._id.slice(-8)}</td>
        <td className="px-4 py-3">
          {tx.customerId && typeof tx.customerId === 'object' ? (
            <div>
              <span className="font-medium">{tx.customerId.name}</span>
              <span className="block text-xs text-muted-foreground">{tx.customerId.email}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">{tx.walkInCustomerName || 'Walk-in'}</span>
          )}
        </td>
        {/* Items summary */}
        <td className="px-4 py-3">
          {itemCount !== null ? (
            <Button variant="link" size="xs" className="h-auto p-0" onClick={onToggleExpand}>
              {itemCount} item{itemCount !== 1 ? 's' : ''} ({items!.length} product{items!.length !== 1 ? 's' : ''})
            </Button>
          ) : (
            <Button variant="link" size="xs" className="h-auto p-0 text-muted-foreground hover:text-primary hover:no-underline" onClick={onToggleExpand}>
              View items
            </Button>
          )}
        </td>
        <td className={`px-4 py-3 font-medium ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>{fmt(tx.totalAmount)}</td>
        <td className={`px-4 py-3 font-medium ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>{fmt(tx.grossProfit)}</td>
        <td className="px-4 py-3">
          {isCancelled ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="flex items-center gap-1">
              <ClaimBadge status={tx.claimStatus} />
              <StatusDateInfo
                label="Date claimed"
                date={tx.claimedAt}
                active={tx.claimStatus === 'claimed'}
                emptyText="Not yet claimed"
              />
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          {isCancelled ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <div className="flex items-center gap-1">
              <PaymentBadge status={tx.paymentStatus} totalAmount={tx.totalAmount} amountPaid={tx.amountPaid} />
              <StatusDateInfo
                label="Date paid"
                date={tx.paidAt}
                active={tx.paymentStatus === 'paid'}
                emptyText={tx.paymentStatus === 'partial' ? 'Not fully paid yet' : 'Not yet paid'}
              />
            </div>
          )}
        </td>
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(new Date(tx.createdAt))}</td>
        <td className="px-4 py-3 text-right">
          {isCancelled ? (
            <div className="flex items-center justify-end gap-0.5">
              {onViewNotes && (
                <div className="relative">
                  <Button variant="ghost" size="icon" className="size-7" disabled={isUpdating} onClick={() => onViewNotes(tx)} title="View notes">
                    <NotepadText />
                  </Button>
                  {(tx.notes?.trim() || tx.customerNotes?.trim()) && (
                    <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-operational ring-1 ring-card pointer-events-none" />
                  )}
                </div>
              )}
              {onEditCustomer && (
                <Button variant="ghost" size="icon" className="size-7" disabled={isUpdating} onClick={onEditCustomer} title="Edit customer">
                  <Pencil />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-error-soft hover:text-destructive" disabled={isUpdating} onClick={onDeleteClick} title="Delete transaction">
                <Trash2 />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-0.5">
              {onViewNotes && (
                <div className="relative">
                  <Button variant="ghost" size="icon" className="size-7" disabled={isUpdating} onClick={() => onViewNotes(tx)} title="View notes">
                    <NotepadText />
                  </Button>
                  {(tx.notes?.trim() || tx.customerNotes?.trim()) && (
                    <span className="absolute right-0.5 top-0.5 size-2 rounded-full bg-operational ring-1 ring-card pointer-events-none" />
                  )}
                </div>
              )}
              {onEditCustomer && (
                <Button variant="ghost" size="icon" className="size-7" disabled={isUpdating} onClick={onEditCustomer} title="Edit customer">
                  <Pencil />
                </Button>
              )}
              {tx.claimStatus === 'unclaimed' ? (
                <Button variant="ghost" size="icon" className="size-7 text-warning hover:text-operational hover:bg-operational-subtle" disabled={isUpdating} onClick={() => onRequestStatusChange(tx, 'claimStatus', 'claimed')} title="Mark as claimed">
                  <Package />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-warning hover:bg-warning-soft" disabled={isUpdating} onClick={() => onRequestStatusChange(tx, 'claimStatus', 'unclaimed')} title="Revert to unclaimed">
                  <RotateCcw />
                </Button>
              )}
              {tx.paymentStatus === 'unpaid' ? (
                <>
                  <Button variant="ghost" size="icon" className="size-7 text-warning hover:text-success hover:bg-success-soft" disabled={isUpdating} onClick={() => onRequestStatusChange(tx, 'paymentStatus', 'paid')} title="Mark as paid">
                    <Check />
                  </Button>
                  {onRequestPartialPayment && (
                    <Button variant="ghost" size="icon" className="size-7 text-warning hover:text-info hover:bg-info-soft" disabled={isUpdating} onClick={() => onRequestPartialPayment(tx)} title="Set partial payment">
                      <Coins />
                    </Button>
                  )}
                </>
              ) : tx.paymentStatus === 'partial' ? (
                <>
                  <Button variant="ghost" size="icon" className="size-7 text-info hover:text-success hover:bg-success-soft" disabled={isUpdating} onClick={() => onRequestStatusChange(tx, 'paymentStatus', 'paid')} title="Mark as fully paid">
                    <Check />
                  </Button>
                  {onRequestPartialPayment && (
                    <Button variant="ghost" size="icon" className="size-7 text-info hover:text-info hover:bg-info-soft" disabled={isUpdating} onClick={() => onRequestPartialPayment(tx)} title="Edit partial amount">
                      <Coins />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-warning hover:bg-warning-soft" disabled={isUpdating} onClick={() => onRequestStatusChange(tx, 'paymentStatus', 'unpaid')} title="Revert to unpaid">
                    <RotateCcw />
                  </Button>
                </>
              ) : (
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-warning hover:bg-warning-soft" disabled={isUpdating} onClick={() => onRequestStatusChange(tx, 'paymentStatus', 'unpaid')} title="Revert to unpaid">
                  <RotateCcw />
                </Button>
              )}
              {hasPendingCancelRequest && (
                <Button variant="ghost" size="icon" className="size-7 text-warning hover:bg-warning-soft hover:text-warning" disabled={isUpdating} onClick={onReviewCancelRequest} title="Review cancellation request">
                  <AlertTriangle />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-error-soft hover:text-destructive" disabled={isUpdating} onClick={onCancelClick} title="Cancel order">
                <Ban />
              </Button>
              <Button variant="ghost" size="icon" className="size-7 text-destructive hover:bg-error-soft hover:text-destructive" disabled={isUpdating} onClick={onDeleteClick} title="Delete transaction">
                <Trash2 />
              </Button>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded items row */}
      {isExpanded && (
        <tr className={isCancelled ? 'row-muted' : 'row-sub'}>
          <td colSpan={COL_COUNT} className="px-0 py-0">
            <div className="px-10 py-3 border-b">
              {isLoadingItems ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Spinner /> Loading items...
                </div>
              ) : items && items.length > 0 ? (
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th className="text-left py-1.5">Product</th>
                      <th className="text-center py-1.5">Qty</th>
                      <th className="text-right py-1.5">Unit Price</th>
                      <th className="text-right py-1.5">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item._id} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 font-medium">
                          {item.productId ? item.productId.name : <span className="italic text-muted-foreground">Deleted product</span>}
                        </td>
                        <td className="py-1.5 px-4 text-center">
                          <Badge variant="secondary">{item.quantity}</Badge>
                        </td>
                        <td className="py-1.5 px-4 text-right text-muted-foreground">
                          {item.quantity > 0 ? fmt(item.subtotal / item.quantity) : '—'}
                        </td>
                        <td className="py-1.5 px-4 text-right font-medium">{fmt(item.subtotal)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="pt-2 pr-4 font-semibold text-muted-foreground">
                        Total ({items.reduce((s, i) => s + i.quantity, 0)} items)
                      </td>
                      <td />
                      <td />
                      <td className="pt-2 px-4 text-right font-bold">{fmt(tx.totalAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <Empty className="border-0 p-2 md:p-2">
                  <EmptyHeader>
                    <EmptyDescription>No items found for this transaction.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

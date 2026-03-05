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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Ban, Check, ChevronDown, ChevronRight, Download, FileSpreadsheet, History, Loader2, Package, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';

type ClaimStatus = 'unclaimed' | 'claimed';
type PaymentStatus = 'unpaid' | 'paid';
type OrderStatus = 'active' | 'cancelled';

interface Transaction {
  _id: string;
  storeId: string;
  customerId?: { _id: string; name: string; email: string } | null;
  totalAmount: number;
  totalCost: number;
  grossProfit: number;
  claimStatus: ClaimStatus;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
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
  createdAt: string;
}

interface TransactionManagerProps {
  storeId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const COL_COUNT = 10;

function ClaimBadge({ status }: { status: ClaimStatus }) {
  return status === 'claimed' ? (
    <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-xs">Claimed</Badge>
  ) : (
    <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-0 text-xs">Unclaimed</Badge>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  return status === 'paid' ? (
    <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-xs">Paid</Badge>
  ) : (
    <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-xs">Unpaid</Badge>
  );
}

function OrderBadge({ status }: { status: OrderStatus }) {
  return status === 'cancelled' ? (
    <Badge variant="destructive" className="text-xs">Cancelled</Badge>
  ) : (
    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-xs">Active</Badge>
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
    return <div className="py-12 text-center text-muted-foreground">Loading report history...</div>;
  }

  return (
    <>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date/Time Generated</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Generated By</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Transaction Date</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
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
              reports.map((r) => (
                <tr key={r._id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {r.generatedBy?.name ?? <span className="text-muted-foreground italic">Unknown</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.transactionDate}</td>
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
              <p><span className="text-muted-foreground">Transaction Date:</span> <span className="font-mono">{deleteTarget.transactionDate}</span></p>
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

// ---------------------------------------------------------------------------
// Main TransactionManager
// ---------------------------------------------------------------------------

export function TransactionManager({ storeId }: TransactionManagerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Transaction | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [filterClaim, setFilterClaim] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterOrder, setFilterOrder] = useState('all');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsCache, setItemsCache] = useState<Record<string, TransactionItemDetail[]>>({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [reportHistoryKey, setReportHistoryKey] = useState(0);

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams({ storeId });
      if (filterClaim !== 'all') params.set('claimStatus', filterClaim);
      if (filterPayment !== 'all') params.set('paymentStatus', filterPayment);
      if (filterOrder !== 'all') params.set('orderStatus', filterOrder);
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
    setLoading(true);
    fetchTransactions();
  }, [filterClaim, filterPayment, filterOrder]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:store', storeId);

    const handleCreated = (tx: Transaction) => {
      setTransactions((prev) => [tx, ...prev]);
    };

    const handleUpdated = (tx: Transaction) => {
      setTransactions((prev) =>
        prev.map((t) => (t._id === tx._id ? { ...t, ...tx } : t))
      );
    };

    socket.on('transaction:created', handleCreated);
    socket.on('transaction:updated', handleUpdated);

    return () => {
      socket.off('transaction:created', handleCreated);
      socket.off('transaction:updated', handleUpdated);
      socket.emit('leave:store', storeId);
    };
  }, [storeId]);

  const updateStatus = async (txId: string, field: 'claimStatus' | 'paymentStatus', value: string) => {
    setUpdating(txId);
    try {
      const res = await fetch(`/api/transactions/${txId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
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

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/transaction-reports/generate?storeId=${storeId}`, {
        method: 'POST',
      });
      if (res.ok) {
        setReportHistoryKey((k) => k + 1);
        toast.success('Report generated');
      } else {
        toast.error('Failed to generate report');
      }
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">Reservations and sales history</p>
        </div>
        <div className="py-12 text-center text-muted-foreground">Loading transactions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">Manage reservations, claiming, and payment statuses</p>
      </div>

      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">
            <FileSpreadsheet className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="report-history">
            <History className="h-4 w-4" />
            Report History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          {/* Filters + Generate button */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Claim:</Label>
              <Select value={filterClaim} onValueChange={setFilterClaim}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unclaimed">Unclaimed</SelectItem>
                  <SelectItem value="claimed">Claimed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Payment:</Label>
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Order:</Label>
              <Select value={filterOrder} onValueChange={setFilterOrder}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReport}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                )}
                {generating ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Items</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Profit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Order</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Claiming</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={COL_COUNT + 1} className="px-4 py-8 text-center text-muted-foreground">No transactions found</td>
                  </tr>
                ) : (
                  transactions.map((tx) => {
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
                        onUpdateStatus={updateStatus}
                        onCancelClick={() => setCancelTarget(tx)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="report-history" className="space-y-4">
          <ReportHistory key={reportHistoryKey} storeId={storeId} />
        </TabsContent>
      </Tabs>

      {/* Cancel confirmation dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this order? The reserved items will be returned to stock.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="rounded-md border px-4 py-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Order ID:</span> <span className="font-mono">{cancelTarget._id.slice(-8)}</span></p>
              <p><span className="text-muted-foreground">Customer:</span> {cancelTarget.customerId && typeof cancelTarget.customerId === 'object' ? cancelTarget.customerId.name : 'Walk-in'}</p>
              <p><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{fmt(cancelTarget.totalAmount)}</span></p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelling}>Keep Order</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling...' : 'Yes, Cancel Order'}
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
  onUpdateStatus,
  onCancelClick,
}: {
  tx: Transaction;
  isUpdating: boolean;
  isCancelled: boolean;
  isExpanded: boolean;
  items: TransactionItemDetail[] | undefined;
  itemCount: number | null;
  isLoadingItems: boolean;
  onToggleExpand: () => void;
  onUpdateStatus: (txId: string, field: 'claimStatus' | 'paymentStatus', value: string) => void;
  onCancelClick: () => void;
}) {
  return (
    <>
      <tr className={`border-b last:border-0 ${isCancelled ? 'opacity-60 bg-muted/30' : 'hover:bg-muted/50'}`}>
        {/* Expand toggle */}
        <td className="px-2 py-3">
          <button onClick={onToggleExpand} className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors" title="View items">
            {isLoadingItems ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{tx._id.slice(-8)}</td>
        <td className="px-4 py-3">
          {tx.customerId && typeof tx.customerId === 'object' ? (
            <div>
              <span className="font-medium">{tx.customerId.name}</span>
              <span className="block text-xs text-muted-foreground">{tx.customerId.email}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground italic">Walk-in</span>
          )}
        </td>
        {/* Items summary */}
        <td className="px-4 py-3">
          {itemCount !== null ? (
            <button onClick={onToggleExpand} className="text-xs text-primary hover:underline cursor-pointer">
              {itemCount} item{itemCount !== 1 ? 's' : ''} ({items!.length} product{items!.length !== 1 ? 's' : ''})
            </button>
          ) : (
            <button onClick={onToggleExpand} className="text-xs text-muted-foreground hover:text-primary cursor-pointer">
              View items
            </button>
          )}
        </td>
        <td className={`px-4 py-3 font-medium ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>{fmt(tx.totalAmount)}</td>
        <td className={`px-4 py-3 ${isCancelled ? 'line-through text-muted-foreground' : 'text-green-600'}`}>{fmt(tx.grossProfit)}</td>
        <td className="px-4 py-3"><OrderBadge status={tx.orderStatus ?? 'active'} /></td>
        <td className="px-4 py-3">{isCancelled ? <span className="text-xs text-muted-foreground">—</span> : <ClaimBadge status={tx.claimStatus} />}</td>
        <td className="px-4 py-3">{isCancelled ? <span className="text-xs text-muted-foreground">—</span> : <PaymentBadge status={tx.paymentStatus} />}</td>
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
        <td className="px-4 py-3 text-right">
          {isCancelled ? (
            <span className="text-xs text-muted-foreground italic">Cancelled</span>
          ) : (
            <div className="flex items-center justify-end gap-1">
              {tx.claimStatus === 'unclaimed' ? (
                <Button variant="outline" size="sm" disabled={isUpdating} onClick={() => onUpdateStatus(tx._id, 'claimStatus', 'claimed')} title="Mark as claimed">
                  <Package className="mr-1 h-3.5 w-3.5" />Claim
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={isUpdating} onClick={() => onUpdateStatus(tx._id, 'claimStatus', 'unclaimed')} title="Revert to unclaimed" className="text-muted-foreground">
                  <Package className="mr-1 h-3.5 w-3.5" />Unclaim
                </Button>
              )}
              {tx.paymentStatus === 'unpaid' ? (
                <Button variant="default" size="sm" disabled={isUpdating} onClick={() => onUpdateStatus(tx._id, 'paymentStatus', 'paid')} title="Mark as paid">
                  <Check className="mr-1 h-3.5 w-3.5" />Pay
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={isUpdating} onClick={() => onUpdateStatus(tx._id, 'paymentStatus', 'unpaid')} title="Revert to unpaid" className="text-muted-foreground">
                  <Check className="mr-1 h-3.5 w-3.5" />Unpay
                </Button>
              )}
              <Button variant="ghost" size="sm" disabled={isUpdating} onClick={onCancelClick} title="Cancel order" className="text-destructive hover:text-destructive">
                <Ban className="mr-1 h-3.5 w-3.5" />Cancel
              </Button>
            </div>
          )}
        </td>
      </tr>

      {/* Expanded items row */}
      {isExpanded && (
        <tr className={isCancelled ? 'opacity-60 bg-muted/30' : 'bg-muted/20'}>
          <td colSpan={COL_COUNT + 1} className="px-0 py-0">
            <div className="px-10 py-3 border-b">
              {isLoadingItems ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading items...
                </div>
              ) : items && items.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">Product</th>
                      <th className="text-center py-1.5 px-4 font-medium text-muted-foreground">Qty</th>
                      <th className="text-right py-1.5 px-4 font-medium text-muted-foreground">Unit Price</th>
                      <th className="text-right py-1.5 px-4 font-medium text-muted-foreground">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item._id} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 font-medium">
                          {item.productId ? item.productId.name : <span className="italic text-muted-foreground">Deleted product</span>}
                        </td>
                        <td className="py-1.5 px-4 text-center">
                          <span className="inline-flex items-center justify-center bg-primary/10 text-primary font-semibold rounded-full h-5 min-w-[20px] px-1.5 text-[11px]">
                            {item.quantity}
                          </span>
                        </td>
                        <td className="py-1.5 px-4 text-right text-muted-foreground">
                          {item.productId ? fmt(item.productId.sellingPrice) : '—'}
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
                <p className="text-xs text-muted-foreground py-2">No items found for this transaction.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

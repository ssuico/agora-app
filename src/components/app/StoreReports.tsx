import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Store, WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerFeedback } from './CustomerFeedback';
import { CustomerInteractions } from './CustomerInteractions';
import { TopProducts } from './TopProducts';

interface SummaryData {
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  transactionCount: number;
}

interface StoreState {
  isOpen: boolean;
  isMaintenance: boolean;
}

interface StoreReportsProps {
  storeId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

export function StoreReports({ storeId }: StoreReportsProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [storeState, setStoreState] = useState<StoreState>({ isOpen: true, isMaintenance: false });
  const [storeStateLoading, setStoreStateLoading] = useState(true);
  const [togglingOpen, setTogglingOpen] = useState(false);
  const [togglingMaintenance, setTogglingMaintenance] = useState(false);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const res = await fetch(`/api/reports/summary?storeId=${storeId}`);
      if (!res.ok) throw new Error('Failed to load summary');
      setSummary(await res.json());
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchStoreState = async () => {
    setStoreStateLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}`);
      if (res.ok) {
        const data = await res.json();
        setStoreState({
          isOpen: data.isOpen !== false,
          isMaintenance: data.isMaintenance === true,
        });
      }
    } catch {
      // silently ignore — controls won't show
    } finally {
      setStoreStateLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchStoreState();
  }, [storeId]);

  const handleToggleOpen = async () => {
    const next = !storeState.isOpen;
    setTogglingOpen(true);
    const prev = storeState;
    setStoreState((s) => ({ ...s, isOpen: next }));
    try {
      const res = await fetch(`/api/stores/${storeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isOpen: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to update store');
        setStoreState(prev);
      } else {
        toast.success(next ? 'Store is now open for customers' : 'Store is now closed for customers');
      }
    } catch {
      toast.error('Failed to update store');
      setStoreState(prev);
    } finally {
      setTogglingOpen(false);
    }
  };

  const handleToggleMaintenance = async () => {
    const next = !storeState.isMaintenance;
    setTogglingMaintenance(true);
    const prev = storeState;
    setStoreState((s) => ({ ...s, isMaintenance: next }));
    try {
      const res = await fetch(`/api/stores/${storeId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMaintenance: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Failed to update store');
        setStoreState(prev);
      } else {
        toast.success(
          next
            ? 'Maintenance mode enabled — store page is now unavailable'
            : 'Maintenance mode disabled — store page is accessible again'
        );
      }
    } catch {
      toast.error('Failed to update store');
      setStoreState(prev);
    } finally {
      setTogglingMaintenance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with store controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview, feedback, and activity insights</p>
        </div>

        {!storeStateLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                storeState.isMaintenance
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : storeState.isOpen
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  storeState.isMaintenance
                    ? 'bg-amber-500'
                    : storeState.isOpen
                    ? 'bg-green-500'
                    : 'bg-red-500'
                }`}
              />
              {storeState.isMaintenance ? 'Maintenance' : storeState.isOpen ? 'Open' : 'Closed'}
            </span>

            <div className="h-4 w-px bg-border" />

            <Button
              variant={storeState.isOpen ? 'destructive' : 'default'}
              size="sm"
              onClick={handleToggleOpen}
              disabled={togglingOpen || togglingMaintenance}
              className="gap-1.5"
            >
              {togglingOpen ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Store className="h-3.5 w-3.5" />
              )}
              {storeState.isOpen ? 'Close Store' : 'Open Store'}
            </Button>

            <Button
              variant={storeState.isMaintenance ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleMaintenance}
              disabled={togglingOpen || togglingMaintenance}
              className="gap-1.5"
            >
              {togglingMaintenance ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <WrenchIcon className="h-3.5 w-3.5" />
              )}
              {storeState.isMaintenance ? 'Disable Maintenance' : 'Maintenance'}
            </Button>
          </div>
        )}
      </div>

      {/* Main content: full-width tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="feedback">Customer Feedback</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="top-products">Top Products</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          {summaryLoading ? (
            <div className="py-12 text-center text-muted-foreground">Loading summary...</div>
          ) : summaryError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {summaryError}
            </div>
          ) : summary ? (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Financial Summary</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Total Sales" value={fmt(summary.totalSales)} />
                <StatCard label="COGS" value={fmt(summary.totalCOGS)} className="text-muted-foreground" />
                <StatCard label="Gross Profit" value={fmt(summary.grossProfit)} className="text-green-600" />
                <StatCard label="Transactions" value={String(summary.transactionCount)} />
              </div>
              <div className="rounded-lg border bg-card p-6">
                <h3 className="mb-4 text-base font-semibold">Profit Breakdown</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Sales</span>
                    <span className="font-medium">{fmt(summary.totalSales)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost of Goods Sold</span>
                    <span className="font-medium text-destructive">- {fmt(summary.totalCOGS)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="font-semibold">Gross Profit</span>
                    <span
                      className={`font-bold ${summary.grossProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}
                    >
                      {fmt(summary.grossProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* Customer Feedback Tab */}
        <TabsContent value="feedback">
          <CustomerFeedback storeId={storeId} />
        </TabsContent>

        {/* Customer Interactions Tab */}
        <TabsContent value="interactions">
          <CustomerInteractions storeId={storeId} />
        </TabsContent>

        {/* Top Products Tab */}
        <TabsContent value="top-products">
          <TopProducts storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${className ?? ''}`}>{value}</p>
    </div>
  );
}

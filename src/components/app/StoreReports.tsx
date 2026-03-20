import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowUpRight,
  CalendarDays,
  DollarSign,
  Loader2,
  Package,
  Receipt,
  Store,
  TrendingUp,
  WrenchIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CustomerFeedback } from './CustomerFeedback';
import { CustomerInteractions } from './CustomerInteractions';
import { DashboardCharts } from './DashboardCharts';
import { ProductSalesTable } from './ProductSalesTable';

interface SummaryData {
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  transactionCount: number;
}

interface DailySoldItem {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface DailyReportData {
  date: string;
  transactionCount: number;
  soldItems: DailySoldItem[];
  totals: {
    unitsSold: number;
    revenue: number;
    cost: number;
    profit: number;
  };
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

const toLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function StoreReports({ storeId }: StoreReportsProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [dailyReport, setDailyReport] = useState<DailyReportData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [dailyDate, setDailyDate] = useState(toLocalDateString(new Date()));

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

  const fetchDailyReport = async (date: string) => {
    setDailyLoading(true);
    setDailyError('');
    try {
      const res = await fetch(`/api/reports/daily?storeId=${storeId}&date=${date}`);
      if (!res.ok) throw new Error('Failed to load daily report');
      setDailyReport(await res.json());
    } catch (e) {
      setDailyError(e instanceof Error ? e.message : 'Error');
    } finally {
      setDailyLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchStoreState();
    fetchDailyReport(dailyDate);
  }, [storeId]);

  useEffect(() => {
    fetchDailyReport(dailyDate);
  }, [dailyDate]);

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
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="feedback">Customer Feedback</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="top-products">Products</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="space-y-8">
            {/* All-time Financial Summary */}
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

            {/* Daily Financial Summary */}
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Daily Financial Summary</h2>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dailyDate}
                    max={toLocalDateString(new Date())}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {dailyDate !== toLocalDateString(new Date()) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDailyDate(toLocalDateString(new Date()))}
                      className="text-xs"
                    >
                      Today
                    </Button>
                  )}
                </div>
              </div>

              {dailyLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading daily data...
                </div>
              ) : dailyError ? (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  {dailyError}
                </div>
              ) : dailyReport ? (
                <div className="space-y-5">
                  {/* Stat cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard label="Revenue" value={fmt(dailyReport.totals.revenue)} icon={<DollarSign className="h-4 w-4" />} />
                    <StatCard label="COGS" value={fmt(dailyReport.totals.cost)} className="text-muted-foreground" icon={<TrendingUp className="h-4 w-4" />} />
                    <StatCard
                      label="Profit"
                      value={fmt(dailyReport.totals.profit)}
                      className={dailyReport.totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}
                      icon={<TrendingUp className="h-4 w-4" />}
                    />
                    <StatCard label="Transactions" value={String(dailyReport.transactionCount)} icon={<Receipt className="h-4 w-4" />} />
                    <StatCard label="Units Sold" value={String(dailyReport.totals.unitsSold)} icon={<Package className="h-4 w-4" />} />
                  </div>

                  {/* Daily profit breakdown */}
                  {dailyReport.totals.revenue > 0 && (
                    <div className="rounded-lg border bg-card p-6">
                      <h3 className="mb-4 text-base font-semibold">Daily Profit Breakdown</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium">{fmt(dailyReport.totals.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost of Goods Sold</span>
                          <span className="font-medium text-destructive">- {fmt(dailyReport.totals.cost)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-3">
                          <span className="font-semibold">Gross Profit</span>
                          <span className={`font-bold ${dailyReport.totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            {fmt(dailyReport.totals.profit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margin</span>
                          <span className={`text-xs font-medium ${dailyReport.totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                            <ArrowUpRight className="mr-0.5 inline h-3 w-3" />
                            {((dailyReport.totals.profit / dailyReport.totals.revenue) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top sold items for the day */}
                  {dailyReport.soldItems.length > 0 && (
                    <div className="rounded-lg border bg-card overflow-hidden">
                      <div className="px-6 py-4 border-b">
                        <h3 className="text-base font-semibold">Products Sold Today</h3>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                            <tr className="border-b">
                              <th className="px-6 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Units</th>
                              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Revenue</th>
                              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cost</th>
                              <th className="px-6 py-2.5 text-right font-medium text-muted-foreground">Profit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyReport.soldItems
                              .sort((a, b) => b.revenue - a.revenue)
                              .map((item) => (
                              <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-6 py-2.5 font-medium">{item.name}</td>
                                <td className="px-4 py-2.5 text-right">{item.unitsSold}</td>
                                <td className="px-4 py-2.5 text-right">{fmt(item.revenue)}</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(item.cost)}</td>
                                <td className={`px-6 py-2.5 text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                                  {fmt(item.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {dailyReport.transactionCount === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No paid transactions recorded for{' '}
                      {new Date(dailyDate + 'T00:00:00').toLocaleDateString('en-PH', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      .
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <DashboardCharts storeId={storeId} />
        </TabsContent>

        {/* Customer Feedback Tab */}
        <TabsContent value="feedback">
          <CustomerFeedback storeId={storeId} />
        </TabsContent>

        {/* Customer Interactions Tab */}
        <TabsContent value="interactions">
          <CustomerInteractions storeId={storeId} />
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="top-products">
          <ProductSalesTable storeId={storeId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value, className, icon }: { label: string; value: string; className?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-2xl font-bold ${className ?? ''}`}>{value}</p>
    </div>
  );
}

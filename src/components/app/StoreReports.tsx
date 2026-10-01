import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowUpRight,
  CalendarDays,
  DollarSign,
  Package,
  Receipt,
  Store,
  TrendingUp,
  WrenchIcon,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
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

const getTodayEST = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

export function StoreReports({ storeId }: StoreReportsProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [dailyReport, setDailyReport] = useState<DailyReportData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [dailyDate, setDailyDate] = useState(getTodayEST());

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
    <div className="flex flex-col gap-6">
      {/* Header with store controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview, feedback, and activity insights</p>
        </div>

        {!storeStateLoading && (
          <Card className="flex-row items-center gap-2 px-4 py-2.5">
            <Badge
              variant={storeState.isMaintenance ? 'warning' : storeState.isOpen ? 'success' : 'destructive'}
              className="gap-1.5 px-2.5 py-1 font-semibold"
            >
              <span className="size-1.5 rounded-full bg-current" />
              {storeState.isMaintenance ? 'Maintenance' : storeState.isOpen ? 'Open' : 'Closed'}
            </Badge>

            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />

            <Button
              variant={storeState.isOpen ? 'destructive' : 'default'}
              size="sm"
              onClick={handleToggleOpen}
              disabled={togglingOpen || togglingMaintenance}
            >
              {togglingOpen ? <Spinner data-icon="inline-start" /> : <Store data-icon="inline-start" />}
              {storeState.isOpen ? 'Close Store' : 'Open Store'}
            </Button>

            <Button
              variant={storeState.isMaintenance ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleMaintenance}
              disabled={togglingOpen || togglingMaintenance}
            >
              {togglingMaintenance ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <WrenchIcon data-icon="inline-start" />
              )}
              {storeState.isMaintenance ? 'Disable Maintenance' : 'Maintenance'}
            </Button>
          </Card>
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
          <div className="flex flex-col gap-8">
            {/* All-time Financial Summary */}
            {summaryLoading ? (
              <div className="flex flex-col gap-6">
                <Skeleton className="h-6 w-40" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="gap-2 py-4">
                      <CardHeader className="px-4">
                        <Skeleton className="h-3.5 w-24" />
                      </CardHeader>
                      <CardContent className="px-4">
                        <Skeleton className="h-7 w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            ) : summaryError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{summaryError}</AlertDescription>
              </Alert>
            ) : summary ? (
              <div className="flex flex-col gap-6">
                <h2 className="text-lg font-semibold">Financial Summary</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Total Sales" value={fmt(summary.totalSales)} />
                  <StatCard label="COGS" value={fmt(summary.totalCOGS)} className="text-muted-foreground" />
                  <StatCard label="Gross Profit" value={fmt(summary.grossProfit)} className="text-success" />
                  <StatCard label="Transactions" value={String(summary.transactionCount)} />
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Profit Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Sales</span>
                      <span className="font-medium">{fmt(summary.totalSales)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cost of Goods Sold</span>
                      <span className="font-medium text-destructive">- {fmt(summary.totalCOGS)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-semibold">Gross Profit</span>
                      <span
                        className={`font-bold ${summary.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {fmt(summary.grossProfit)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {/* Daily Financial Summary */}
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="size-5 text-muted-foreground" />
                  <h2 className="text-lg font-semibold">Daily Financial Summary</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dailyDate}
                    max={getTodayEST()}
                    onChange={(e) => setDailyDate(e.target.value)}
                    className="w-auto"
                  />
                  {dailyDate !== getTodayEST() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDailyDate(getTodayEST())}
                      className="text-xs"
                    >
                      Today
                    </Button>
                  )}
                </div>
              </div>

              {dailyLoading ? (
                <div className="flex flex-col gap-3">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Card key={i} className="gap-2 py-4">
                        <CardHeader className="px-4">
                          <Skeleton className="h-3.5 w-24" />
                        </CardHeader>
                        <CardContent className="px-4">
                          <Skeleton className="h-7 w-3/4" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Skeleton className="h-48 w-full rounded-lg" />
                </div>
              ) : dailyError ? (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{dailyError}</AlertDescription>
                </Alert>
              ) : dailyReport ? (
                <div className="flex flex-col gap-5">
                  {/* Stat cards */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard label="Revenue" value={fmt(dailyReport.totals.revenue)} icon={<DollarSign className="size-4" />} />
                    <StatCard label="COGS" value={fmt(dailyReport.totals.cost)} className="text-muted-foreground" icon={<TrendingUp className="size-4" />} />
                    <StatCard
                      label="Profit"
                      value={fmt(dailyReport.totals.profit)}
                      className={dailyReport.totals.profit >= 0 ? 'text-success' : 'text-destructive'}
                      icon={<TrendingUp className="size-4" />}
                    />
                    <StatCard label="Transactions" value={String(dailyReport.transactionCount)} icon={<Receipt className="size-4" />} />
                    <StatCard label="Units Sold" value={String(dailyReport.totals.unitsSold)} icon={<Package className="size-4" />} />
                  </div>

                  {/* Daily profit breakdown */}
                  {dailyReport.totals.revenue > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Daily Profit Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue</span>
                          <span className="font-medium">{fmt(dailyReport.totals.revenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cost of Goods Sold</span>
                          <span className="font-medium text-destructive">- {fmt(dailyReport.totals.cost)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="font-semibold">Gross Profit</span>
                          <span className={`font-bold ${dailyReport.totals.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {fmt(dailyReport.totals.profit)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Margin</span>
                          <span className={`text-xs font-medium ${dailyReport.totals.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                            <ArrowUpRight className="mr-0.5 inline size-3" />
                            {((dailyReport.totals.profit / dailyReport.totals.revenue) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Top sold items for the day */}
                  {dailyReport.soldItems.length > 0 && (
                    <Card className="gap-0 overflow-hidden py-0">
                      <CardHeader className="px-6 py-4">
                        <CardTitle className="text-base">Products Sold Today</CardTitle>
                      </CardHeader>
                      <Separator />
                      <CardContent className="max-h-72 overflow-y-auto px-0">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted">
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
                                <td className={`px-6 py-2.5 text-right font-medium ${item.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                  {fmt(item.profit)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}

                  {dailyReport.transactionCount === 0 && (
                    <Empty className="p-4 md:p-4">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Receipt />
                        </EmptyMedia>
                        <EmptyDescription>
                          No paid transactions recorded for{' '}
                          {new Date(dailyDate + 'T00:00:00').toLocaleDateString('en-PH', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          .
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
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
    <Card className="gap-1 py-5">
      <CardHeader className="px-5">
        <CardDescription className="flex items-center gap-2">
          {icon}
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        <p className={`text-2xl font-bold ${className ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

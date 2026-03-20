import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Box,
  CalendarDays,
  DollarSign,
  Loader2,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  Label,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SalesPoint {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  transactions: number;
  unitsSold: number;
}

interface ProductRevenue {
  productId: string;
  name: string;
  revenue: number;
  cost: number;
  unitsSold: number;
  profit: number;
}

interface InventoryItem {
  productId: string;
  name: string;
  stockQuantity: number;
  isPerishable: boolean;
  costPrice: number;
  sellingPrice: number;
}

interface RestockPoint {
  date: string;
  units: number;
}

interface ReservationPoint {
  date: string;
  count: number;
}

interface ProductPerf {
  productId: string;
  name: string;
  revenue: number;
  unitsSold: number;
  profit: number;
  avgRating: number;
  ratingCount: number;
  stockQuantity: number;
}

interface KPIs {
  todayRevenue: number;
  todayTransactions: number;
  todayUnitsSold: number;
  weekRevenue: number;
  weekTransactions: number;
  monthRevenue: number;
  monthTransactions: number;
  avgOrderValue: number;
  totalExpenses: number;
  topProduct: { name: string; unitsSold: number } | null;
  reservationsLast24h: number;
  totalInventoryItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  perishableCount: number;
  avgStoreRating: number;
  totalStoreRatings: number;
  avgProductRating: number;
  totalProductRatings: number;
}

interface DashboardData {
  kpis: KPIs;
  salesTimeSeries: SalesPoint[];
  revenueByProduct: ProductRevenue[];
  inventorySnapshot: InventoryItem[];
  restockTimeSeries: RestockPoint[];
  reservationTimeSeries: ReservationPoint[];
  ratingDistribution: number[];
  productPerformance: ProductPerf[];
}

interface DashboardChartsProps {
  storeId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₱${(n / 1_000).toFixed(1)}K`;
  return fmt(n);
};

const shortDate = (d: string) => {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

// Theme-aware palette extending the 5 ShadCN chart vars
const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-5)',
  'var(--chart-4)',
  '#2563eb',
  '#0891b2',
  '#7c3aed',
  '#db2777',
  '#059669',
  '#d97706',
];

const STAR_COLORS = ['#dc2626', '#ea580c', '#d97706', '#65a30d', '#16a34a'];

type DateRange = '7' | '14' | '30' | '60' | '90';

// ---------------------------------------------------------------------------
// Chart configs
// ---------------------------------------------------------------------------

const salesChartConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  profit: { label: 'Profit', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const inventoryBreakdownConfig = {
  perishable: { label: 'Perishable', color: '#d97706' },
  nonPerishable: { label: 'Non-perishable', color: '#2563eb' },
} satisfies ChartConfig;

const restockConfig = {
  units: { label: 'Units Restocked', color: 'var(--chart-5)' },
} satisfies ChartConfig;

const reservationConfig = {
  count: { label: 'Reservations', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const unitsSoldConfig = {
  unitsSold: { label: 'Units Sold', color: 'var(--chart-2)' },
} satisfies ChartConfig;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardCharts({ storeId }: DashboardChartsProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('30');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/reports/dashboard-analytics?storeId=${storeId}&days=${dateRange}`);
      if (!res.ok) throw new Error('Failed to load analytics');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [storeId, dateRange]);

  const revenuePieData = useMemo(() => {
    if (!data) return [];
    const top = data.revenueByProduct.slice(0, 7);
    const rest = data.revenueByProduct.slice(7);
    const otherRevenue = rest.reduce((s, p) => s + p.revenue, 0);
    const result = top.map((p) => ({ name: p.name, value: p.revenue, fill: PALETTE[top.indexOf(p) % PALETTE.length] }));
    if (otherRevenue > 0) result.push({ name: 'Other', value: otherRevenue, fill: 'var(--muted-foreground)' });
    return result;
  }, [data]);

  const revenuePieConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    revenuePieData.forEach((item) => {
      cfg[item.name] = { label: item.name, color: item.fill };
    });
    return cfg;
  }, [revenuePieData]);

  const totalRevenuePie = useMemo(() => revenuePieData.reduce((s, p) => s + p.value, 0), [revenuePieData]);

  const inventoryBreakdown = useMemo(() => {
    if (!data) return { perishable: 0, nonPerishable: 0 };
    const perishable = data.inventorySnapshot.filter((p) => p.isPerishable).reduce((s, p) => s + p.stockQuantity, 0);
    const nonPerishable = data.inventorySnapshot.filter((p) => !p.isPerishable).reduce((s, p) => s + p.stockQuantity, 0);
    return { perishable, nonPerishable };
  }, [data]);

  const revenueBarConfig = useMemo(() => {
    if (!data) return {} as ChartConfig;
    const cfg: ChartConfig = {};
    data.revenueByProduct.slice(0, 10).forEach((p, i) => {
      cfg[p.name] = { label: p.name, color: PALETTE[i % PALETTE.length] };
    });
    cfg['revenue'] = { label: 'Revenue', color: 'var(--chart-1)' };
    return cfg;
  }, [data]);

  const ratingConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    STAR_COLORS.forEach((c, i) => {
      cfg[`${i + 1}★`] = { label: `${i + 1}★`, color: c };
    });
    cfg['count'] = { label: 'Ratings' };
    return cfg;
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
        {/* KPI tiles skeleton — 6 cols */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        {/* Second KPI row — 4 cols */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { kpis } = data;

  return (
    <div className="space-y-8">
      {/* Date range selector + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Analytics</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {([
              { value: '7' as DateRange, label: '7D' },
              { value: '14' as DateRange, label: '14D' },
              { value: '30' as DateRange, label: '30D' },
              { value: '60' as DateRange, label: '60D' },
              { value: '90' as DateRange, label: '90D' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateRange === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ===== KPI TILES ===== */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile icon={<DollarSign className="h-4 w-4" />} label="Today's Revenue" value={fmt(kpis.todayRevenue)} />
        <KpiTile icon={<TrendingUp className="h-4 w-4" />} label="This Week" value={fmtCompact(kpis.weekRevenue)} sub={`${kpis.weekTransactions} txns`} />
        <KpiTile icon={<BarChart3 className="h-4 w-4" />} label={`${dateRange}-Day Revenue`} value={fmtCompact(kpis.monthRevenue)} sub={`${kpis.monthTransactions} txns`} />
        <KpiTile icon={<Receipt className="h-4 w-4" />} label="Avg Order Value" value={fmt(kpis.avgOrderValue)} />
        <KpiTile icon={<ShoppingCart className="h-4 w-4" />} label="Top Product" value={kpis.topProduct?.name ?? '—'} sub={kpis.topProduct ? `${kpis.topProduct.unitsSold} sold` : undefined} className="truncate" />
        <KpiTile icon={<Users className="h-4 w-4" />} label="Reservations (24h)" value={String(kpis.reservationsLast24h)} />
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <KpiTile icon={<Box className="h-4 w-4" />} label="Inventory Items" value={kpis.totalInventoryItems.toLocaleString()} />
        <KpiTile
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Low Stock"
          value={String(kpis.lowStockCount)}
          className={kpis.lowStockCount > 0 ? 'text-amber-600' : ''}
        />
        <KpiTile
          icon={<Package className="h-4 w-4" />}
          label="Out of Stock"
          value={String(kpis.outOfStockCount)}
          className={kpis.outOfStockCount > 0 ? 'text-red-600' : ''}
        />
        <KpiTile
          icon={<Star className="h-4 w-4" />}
          label="Store Rating"
          value={kpis.totalStoreRatings > 0 ? `${kpis.avgStoreRating.toFixed(1)} ★` : 'No ratings'}
          sub={kpis.totalStoreRatings > 0 ? `${kpis.totalStoreRatings} reviews` : undefined}
        />
      </div>

      {/* ===== SECTION 1: SALES & REVENUE ===== */}
      <SectionTitle icon={<TrendingUp className="h-5 w-5" />} title="Sales & Revenue" />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          {data.salesTimeSeries.length > 0 ? (
            <ChartContainer config={salesChartConfig} className="h-[300px] w-full">
              <AreaChart data={data.salesTimeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-profit)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-profit)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickFormatter={(v) => fmtCompact(v)} tickLine={false} axisLine={false} width={60} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => (
                        <div className="flex items-center justify-between gap-8">
                          <span className="text-muted-foreground">{name === 'revenue' ? 'Revenue' : 'Profit'}</span>
                          <span className="font-mono font-medium">{fmt(value as number)}</span>
                        </div>
                      )}
                      labelFormatter={shortDate}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--color-revenue)" fill="url(#revGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" stroke="var(--color-profit)" fill="url(#profitGrad)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          ) : <EmptyChart />}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue per product (bar) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue by Product (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByProduct.length > 0 ? (
              <ChartContainer config={revenueBarConfig} className="h-[300px] w-full">
                <BarChart data={data.revenueByProduct.slice(0, 10)} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => fmtCompact(v)} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="font-mono font-medium">{fmt(value as number)}</span>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="revenue" name="Revenue" radius={[0, 6, 6, 0]}>
                    {data.revenueByProduct.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Revenue contribution donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue Contribution</CardTitle>
          </CardHeader>
          <CardContent>
            {revenuePieData.length > 0 ? (
              <div className="flex flex-col items-center gap-4">
                <ChartContainer config={revenuePieConfig} className="h-[220px] w-full max-w-[280px]">
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => (
                            <div className="flex items-center justify-between gap-6">
                              <span className="text-muted-foreground">{String(name)}</span>
                              <span className="font-mono font-medium">{fmt(value as number)}</span>
                            </div>
                          )}
                          nameKey="name"
                        />
                      }
                    />
                    <Pie
                      data={revenuePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={2}
                      strokeWidth={2}
                      stroke="var(--card)"
                    >
                      <Label
                        content={({ viewBox }) => {
                          if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                            return (
                              <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 8} className="fill-foreground text-lg font-bold">
                                  {fmtCompact(totalRevenuePie)}
                                </tspan>
                                <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 12} className="fill-muted-foreground text-[10px]">
                                  Total Revenue
                                </tspan>
                              </text>
                            );
                          }
                        }}
                      />
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2">
                  {revenuePieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5 text-xs">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.fill }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart />}
          </CardContent>
        </Card>
      </div>

      {/* ===== SECTION 2: INVENTORY & STOCK ===== */}
      <SectionTitle icon={<Package className="h-5 w-5" />} title="Inventory & Stock" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current stock per product */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Current Stock Levels</CardTitle>
          </CardHeader>
          <CardContent>
            {data.inventorySnapshot.length > 0 ? (
              <ChartContainer
                config={{ stockQuantity: { label: 'Stock', color: 'var(--chart-1)' } }}
                className="w-full"
                style={{ height: Math.max(220, Math.min(data.inventorySnapshot.slice(0, 15).length * 28, 380)) }}
              >
                <BarChart data={data.inventorySnapshot.slice(0, 15)} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="stockQuantity" name="Stock" radius={[0, 6, 6, 0]}>
                    {data.inventorySnapshot.slice(0, 15).map((item, i) => (
                      <Cell key={i} fill={item.stockQuantity === 0 ? '#dc2626' : item.stockQuantity < 10 ? '#d97706' : '#16a34a'} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Perishable vs Non-perishable */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Inventory Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-3">
              <ChartContainer config={inventoryBreakdownConfig} className="h-[200px] w-full max-w-[260px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={[
                      { name: 'perishable', value: inventoryBreakdown.perishable, fill: '#d97706' },
                      { name: 'nonPerishable', value: inventoryBreakdown.nonPerishable, fill: '#2563eb' },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={3}
                    strokeWidth={2}
                    stroke="var(--card)"
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                          const total = inventoryBreakdown.perishable + inventoryBreakdown.nonPerishable;
                          return (
                            <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-base font-bold">
                                {total.toLocaleString()}
                              </tspan>
                              <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 10} className="fill-muted-foreground text-[9px]">
                                Total Items
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex justify-center gap-5 text-xs">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-amber-600" /> Perishable: {inventoryBreakdown.perishable}</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px] bg-blue-600" /> Non-perishable: {inventoryBreakdown.nonPerishable}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restock trends */}
      {data.restockTimeSeries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Restock Trends Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={restockConfig} className="h-[250px] w-full">
              <LineChart data={data.restockTimeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={shortDate} />} />
                <Line type="monotone" dataKey="units" stroke="var(--color-units)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-units)' }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* ===== SECTION 3: CUSTOMER ACTIVITY ===== */}
      <SectionTitle icon={<Users className="h-5 w-5" />} title="Customer Activity & Engagement" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Reservations Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {data.reservationTimeSeries.length > 0 ? (
              <ChartContainer config={reservationConfig} className="h-[250px] w-full">
                <AreaChart data={data.reservationTimeSeries} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={shortDate} />} />
                  <Area type="monotone" dataKey="count" stroke="var(--color-count)" fill="url(#resGrad)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Rating distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.ratingDistribution.some((v) => v > 0) ? (
              <div className="space-y-4">
                <ChartContainer config={ratingConfig} className="h-[200px] w-full">
                  <BarChart
                    data={data.ratingDistribution.map((count, i) => ({ stars: `${i + 1}★`, count }))}
                    margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="stars" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" name="Ratings" radius={[6, 6, 0, 0]}>
                      {data.ratingDistribution.map((_, i) => (
                        <Cell key={i} fill={STAR_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
                <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                  <span>Store: {kpis.avgStoreRating > 0 ? `${kpis.avgStoreRating.toFixed(1)}★ (${kpis.totalStoreRatings})` : 'None'}</span>
                  <span className="text-border">|</span>
                  <span>Products: {kpis.avgProductRating > 0 ? `${kpis.avgProductRating.toFixed(1)}★ (${kpis.totalProductRatings})` : 'None'}</span>
                </div>
              </div>
            ) : <EmptyChart message="No ratings yet" />}
          </CardContent>
        </Card>
      </div>

      {/* ===== SECTION 4: PRODUCT PERFORMANCE ===== */}
      <SectionTitle icon={<BarChart3 className="h-5 w-5" />} title="Product Performance" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products sold (bar) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Products by Units Sold</CardTitle>
          </CardHeader>
          <CardContent>
            {data.revenueByProduct.length > 0 ? (
              <ChartContainer config={unitsSoldConfig} className="h-[300px] w-full">
                <BarChart
                  data={[...data.revenueByProduct].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={120} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="unitsSold" name="Units Sold" fill="var(--color-unitsSold)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ChartContainer>
            ) : <EmptyChart />}
          </CardContent>
        </Card>

        {/* Revenue vs Rating scatter */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenue vs Rating</CardTitle>
            <p className="text-xs text-muted-foreground">Identifies high-revenue but low-satisfaction products</p>
          </CardHeader>
          <CardContent>
            {data.productPerformance.filter((p) => p.ratingCount > 0 && p.revenue > 0).length > 0 ? (
              <ChartContainer config={{ scatter: { label: 'Products', color: 'var(--chart-1)' } }} className="h-[300px] w-full">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="avgRating" name="Avg Rating" domain={[0, 5.5]} tickLine={false} axisLine={false} label={{ value: 'Rating', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }} />
                  <YAxis type="number" dataKey="revenue" name="Revenue" tickFormatter={(v) => fmtCompact(v)} tickLine={false} axisLine={false} width={60} label={{ value: 'Revenue', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <ZAxis type="number" dataKey="unitsSold" range={[40, 400]} name="Units Sold" />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload as ProductPerf;
                      return (
                        <div className="rounded-lg border border-border/50 bg-background p-3 text-xs shadow-xl">
                          <p className="font-semibold">{d.name}</p>
                          <p className="text-muted-foreground">Revenue: <span className="font-medium text-foreground">{fmt(d.revenue)}</span></p>
                          <p className="text-muted-foreground">Rating: <span className="font-medium text-foreground">{d.avgRating.toFixed(1)}★ ({d.ratingCount})</span></p>
                          <p className="text-muted-foreground">Units: <span className="font-medium text-foreground">{d.unitsSold}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Scatter
                    data={data.productPerformance.filter((p) => p.ratingCount > 0 && p.revenue > 0)}
                    fill="var(--chart-1)"
                    fillOpacity={0.75}
                  />
                </ScatterChart>
              </ChartContainer>
            ) : <EmptyChart message="Need products with both sales and ratings" />}
          </CardContent>
        </Card>
      </div>

      {/* Most profitable + highest rated tiles */}
      {data.productPerformance.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(() => {
            const mostProfitable = [...data.productPerformance].sort((a, b) => b.profit - a.profit)[0];
            return mostProfitable ? (
              <Card className="p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Most Profitable</p>
                <p className="mt-1 text-lg font-bold truncate">{mostProfitable.name}</p>
                <p className="text-sm text-green-600 font-medium">{fmt(mostProfitable.profit)} profit</p>
              </Card>
            ) : null;
          })()}
          {(() => {
            const highestRated = [...data.productPerformance].filter((p) => p.ratingCount > 0).sort((a, b) => b.avgRating - a.avgRating)[0];
            return highestRated ? (
              <Card className="p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> Highest Rated</p>
                <p className="mt-1 text-lg font-bold truncate">{highestRated.name}</p>
                <p className="text-sm text-amber-600 font-medium">{highestRated.avgRating.toFixed(1)}★ ({highestRated.ratingCount} reviews)</p>
              </Card>
            ) : null;
          })()}
          {(() => {
            const bestSeller = [...data.productPerformance].sort((a, b) => b.unitsSold - a.unitsSold)[0];
            return bestSeller ? (
              <Card className="p-5">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowUpRight className="h-3.5 w-3.5" /> Best Seller</p>
                <p className="mt-1 text-lg font-bold truncate">{bestSeller.name}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--chart-1)' }}>{bestSeller.unitsSold.toLocaleString()} units sold</p>
              </Card>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiTile({ icon, label, value, sub, className }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`mt-1 text-xl font-bold ${className ?? ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-primary">{icon}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function EmptyChart({ message = 'No data available' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

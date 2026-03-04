import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, Package, TrendingUp } from 'lucide-react';

interface SummaryData {
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  transactionCount: number;
}

interface SoldItem {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface InventoryItem {
  productId: string;
  name: string;
  stockQuantity: number;
  sellingPrice: number;
  costPrice: number;
}

interface DailyData {
  date: string;
  transactionCount: number;
  soldItems: SoldItem[];
  totals: {
    unitsSold: number;
    revenue: number;
    cost: number;
    profit: number;
  };
  inventory: InventoryItem[];
}

interface InvProductSummary {
  productId: string;
  productName: string;
  totalInitialStock: number;
  totalRestock: number;
  totalSold: number;
  latestCurrentStock: number;
  latestDate: string;
  daysTracked: number;
}

interface InvDailyRow {
  date: string;
  productId: string;
  productName: string;
  initialStock: number;
  restock: number;
  carryOverStock: number;
  sold: number;
  currentStock: number;
}

interface InventoryReportData {
  startDate: string;
  endDate: string;
  products: InvProductSummary[];
  dailyBreakdown: InvDailyRow[];
}

interface StoreReportsProps {
  storeId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Tab = 'summary' | 'daily' | 'inventory';

export function StoreReports({ storeId }: StoreReportsProps) {
  const [tab, setTab] = useState<Tab>('summary');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [selectedDate, setSelectedDate] = useState(todayString());
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState('');

  const [invStart, setInvStart] = useState(daysAgo(7));
  const [invEnd, setInvEnd] = useState(todayString());
  const [invData, setInvData] = useState<InventoryReportData | null>(null);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');

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

  const fetchDaily = async (date: string) => {
    setDailyLoading(true);
    setDailyError('');
    try {
      const res = await fetch(`/api/reports/daily?storeId=${storeId}&date=${date}`);
      if (!res.ok) throw new Error('Failed to load daily report');
      setDaily(await res.json());
    } catch (e) {
      setDailyError(e instanceof Error ? e.message : 'Error');
    } finally {
      setDailyLoading(false);
    }
  };

  const fetchInventory = async () => {
    setInvLoading(true);
    setInvError('');
    try {
      const params = new URLSearchParams({ storeId, startDate: invStart, endDate: invEnd });
      const res = await fetch(`/api/reports/inventory?${params}`);
      if (!res.ok) throw new Error('Failed to load inventory report');
      setInvData(await res.json());
    } catch (e) {
      setInvError(e instanceof Error ? e.message : 'Error');
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => { fetchSummary(); }, []);

  useEffect(() => {
    if (tab === 'daily') fetchDaily(selectedDate);
  }, [tab, selectedDate]);

  useEffect(() => {
    if (tab === 'inventory') fetchInventory();
  }, [tab]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-sm text-muted-foreground">Summary, daily breakdown, and inventory tracking</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
        <button onClick={() => setTab('summary')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'summary' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <TrendingUp className="h-3.5 w-3.5" />Summary
        </button>
        <button onClick={() => setTab('daily')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'daily' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <CalendarDays className="h-3.5 w-3.5" />Daily Report
        </button>
        <button onClick={() => setTab('inventory')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'inventory' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Package className="h-3.5 w-3.5" />Inventory
        </button>
      </div>

      {tab === 'summary' && <SummaryTab data={summary} loading={summaryLoading} error={summaryError} />}
      {tab === 'daily' && (
        <DailyTab data={daily} loading={dailyLoading} error={dailyError} selectedDate={selectedDate} onDateChange={setSelectedDate} />
      )}
      {tab === 'inventory' && (
        <InventoryTab
          data={invData}
          loading={invLoading}
          error={invError}
          startDate={invStart}
          endDate={invEnd}
          onStartChange={setInvStart}
          onEndChange={setInvEnd}
          onFetch={fetchInventory}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary Tab
// ---------------------------------------------------------------------------

function SummaryTab({ data, loading, error }: { data: SummaryData | null; loading: boolean; error: string }) {
  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading summary...</div>;
  if (error) return <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Sales" value={fmt(data.totalSales)} />
        <StatCard label="COGS" value={fmt(data.totalCOGS)} className="text-muted-foreground" />
        <StatCard label="Gross Profit" value={fmt(data.grossProfit)} className="text-green-600" />
        <StatCard label="Transactions" value={String(data.transactionCount)} />
      </div>
      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Profit Breakdown</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Total Sales</span><span className="font-medium">{fmt(data.totalSales)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Cost of Goods Sold</span><span className="font-medium text-destructive">- {fmt(data.totalCOGS)}</span></div>
          <div className="flex justify-between border-t pt-3"><span className="font-semibold">Gross Profit</span><span className={`font-bold ${data.grossProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(data.grossProfit)}</span></div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily Tab
// ---------------------------------------------------------------------------

function DailyTab({ data, loading, error, selectedDate, onDateChange }: {
  data: DailyData | null; loading: boolean; error: string; selectedDate: string; onDateChange: (d: string) => void;
}) {
  const goDay = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    onDateChange(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => goDay(-1)}>&larr; Prev</Button>
        <Input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="w-44" />
        <Button variant="outline" size="sm" onClick={() => goDay(1)}>Next &rarr;</Button>
        <Button variant="ghost" size="sm" onClick={() => onDateChange(todayString())} disabled={selectedDate === todayString()}>Today</Button>
      </div>

      {loading && <div className="py-12 text-center text-muted-foreground">Loading report...</div>}
      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Units Sold" value={String(data.totals.unitsSold)} />
            <StatCard label="Revenue" value={fmt(data.totals.revenue)} />
            <StatCard label="COGS" value={fmt(data.totals.cost)} className="text-muted-foreground" />
            <StatCard label="Gross Profit" value={fmt(data.totals.profit)} className={data.totals.profit >= 0 ? 'text-green-600' : 'text-destructive'} />
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Units Sold{data.transactionCount > 0 && <span className="ml-2 font-normal text-muted-foreground">({data.transactionCount} transaction{data.transactionCount !== 1 ? 's' : ''})</span>}</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Qty Sold</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Revenue</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cost</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Profit</th>
              </tr></thead>
              <tbody>
                {data.soldItems.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No sales recorded for this date.</td></tr>
                ) : (
                  <>
                    {data.soldItems.map((item) => (
                      <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-2.5 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 text-right">{item.unitsSold}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(item.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(item.cost)}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(item.profit)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right">{data.totals.unitsSold}</td>
                      <td className="px-4 py-2.5 text-right">{fmt(data.totals.revenue)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(data.totals.cost)}</td>
                      <td className={`px-4 py-2.5 text-right ${data.totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(data.totals.profit)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Current Inventory (Unsold Stock)</h3></div>
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">In Stock</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Unit Price</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Unit Cost</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Stock Value</th>
              </tr></thead>
              <tbody>
                {data.inventory.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No products in this store.</td></tr>
                ) : (
                  <>
                    {data.inventory.map((item) => (
                      <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-2.5 font-medium">{item.name}</td>
                        <td className="px-4 py-2.5 text-right"><StockBadge value={item.stockQuantity} /></td>
                        <td className="px-4 py-2.5 text-right">{fmt(item.sellingPrice)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(item.costPrice)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(item.stockQuantity * item.costPrice)}</td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="px-4 py-2.5">Total</td>
                      <td className="px-4 py-2.5 text-right">{data.inventory.reduce((s, i) => s + i.stockQuantity, 0)}</td>
                      <td className="px-4 py-2.5" /><td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-right">{fmt(data.inventory.reduce((s, i) => s + i.stockQuantity * i.costPrice, 0))}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inventory Tab
// ---------------------------------------------------------------------------

function InventoryTab({ data, loading, error, startDate, endDate, onStartChange, onEndChange, onFetch }: {
  data: InventoryReportData | null; loading: boolean; error: string;
  startDate: string; endDate: string;
  onStartChange: (d: string) => void; onEndChange: (d: string) => void;
  onFetch: () => void;
}) {
  const [viewMode, setViewMode] = useState<'summary' | 'daily'>('summary');

  return (
    <div className="space-y-6">
      {/* Date range controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} className="w-40" />
        </div>
        <Button onClick={onFetch} disabled={loading}>{loading ? 'Loading...' : 'Generate Report'}</Button>
      </div>

      {error && <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!loading && data && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 rounded-lg border bg-muted/50 p-1 w-fit">
            <button onClick={() => setViewMode('summary')} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'summary' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Product Summary</button>
            <button onClick={() => setViewMode('daily')} className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${viewMode === 'daily' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Daily Breakdown</button>
          </div>

          {viewMode === 'summary' && <InventorySummaryTable products={data.products} />}
          {viewMode === 'daily' && <InventoryDailyTable rows={data.dailyBreakdown} />}
        </>
      )}

      {!loading && !data && !error && (
        <p className="py-8 text-center text-muted-foreground">Select a date range and click "Generate Report" to view inventory data.</p>
      )}
    </div>
  );
}

function InventorySummaryTable({ products }: { products: InvProductSummary[] }) {
  if (products.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No inventory records found for this date range.</p>;
  }

  const totals = products.reduce((acc, p) => ({
    initialStock: acc.initialStock + p.totalInitialStock,
    restock: acc.restock + p.totalRestock,
    sold: acc.sold + p.totalSold,
    currentStock: acc.currentStock + p.latestCurrentStock,
  }), { initialStock: 0, restock: 0, sold: 0, currentStock: 0 });

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <div className="border-b px-4 py-3"><h3 className="text-sm font-semibold">Product Inventory Summary</h3></div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Days Tracked</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total Initial</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total Restock</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total Sold</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Latest Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.productId} className="border-b last:border-0 hover:bg-muted/50">
              <td className="px-4 py-2.5 font-medium">{p.productName}</td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">{p.daysTracked}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{p.totalInitialStock}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {p.totalRestock > 0 ? <span className="text-blue-600 font-medium">+{p.totalRestock}</span> : <span className="text-muted-foreground">0</span>}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {p.totalSold > 0 ? <span className="text-orange-600 font-medium">{p.totalSold}</span> : <span className="text-muted-foreground">0</span>}
              </td>
              <td className="px-4 py-2.5 text-right"><StockBadge value={p.latestCurrentStock} /></td>
            </tr>
          ))}
          <tr className="bg-muted/30 font-semibold">
            <td className="px-4 py-2.5">Total</td>
            <td className="px-4 py-2.5" />
            <td className="px-4 py-2.5 text-right tabular-nums">{totals.initialStock}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-blue-600">+{totals.restock}</td>
            <td className="px-4 py-2.5 text-right tabular-nums text-orange-600">{totals.sold}</td>
            <td className="px-4 py-2.5 text-right"><StockBadge value={totals.currentStock} /></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function InventoryDailyTable({ rows }: { rows: InvDailyRow[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No daily records found for this date range.</p>;
  }

  const dates = [...new Set(rows.map((r) => r.date))].sort();

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const dayRows = rows.filter((r) => r.date === date);
        return (
          <div key={date} className="rounded-lg border bg-card overflow-x-auto">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">{date}</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Product</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Initial</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Restock</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Carry-over</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Sold</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Current</th>
                </tr>
              </thead>
              <tbody>
                {dayRows.map((row) => (
                  <tr key={row.productId} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2 font-medium">{row.productName}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{row.initialStock}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.restock > 0 ? <span className="text-blue-600 font-medium">+{row.restock}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{row.carryOverStock}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {row.sold > 0 ? <span className="text-orange-600 font-medium">{row.sold}</span> : <span className="text-muted-foreground">0</span>}
                    </td>
                    <td className="px-4 py-2 text-right"><StockBadge value={row.currentStock} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function StockBadge({ value }: { value: number }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${value === 0 ? 'bg-red-100 text-red-700' : value < 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
      {value}
    </span>
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

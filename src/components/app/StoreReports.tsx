import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
}

interface StoreReportsProps {
  storeId: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

/** Must match server APP_TIMEZONE so "today" and date range align with backend. */
const APP_TIMEZONE = 'America/New_York';

/** Today's date (YYYY-MM-DD) in the app timezone, so Sales on date matches backend. */
function todayInAppTz(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

export function StoreReports({ storeId }: StoreReportsProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const [selectedDate, setSelectedDate] = useState(todayInAppTz());
  const [daily, setDaily] = useState<DailyData | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState('');

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

  useEffect(() => {
    fetchSummary();
  }, [storeId]);

  useEffect(() => {
    fetchDaily(selectedDate);
  }, [storeId, selectedDate]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-sm text-muted-foreground">Summary and sales breakdown by date</p>
      </div>

      {/* Summary section */}
      {summaryLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading summary...</div>
      ) : summaryError ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {summaryError}
        </div>
      ) : summary ? (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Summary</h2>
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
                <span className={`font-bold ${summary.grossProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {fmt(summary.grossProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sales by date section */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Sales on date</h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="report-date" className="sr-only">Date</Label>
            <Input
              id="report-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedDate(todayInAppTz())}
              disabled={selectedDate === todayInAppTz()}
            >
              Today
            </Button>
          </div>
        </div>

        {dailyLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading report...</div>
        ) : dailyError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {dailyError}
          </div>
        ) : daily ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Units Sold" value={String(daily.totals.unitsSold)} />
              <StatCard label="Revenue" value={fmt(daily.totals.revenue)} />
              <StatCard label="COGS" value={fmt(daily.totals.cost)} className="text-muted-foreground" />
              <StatCard
                label="Gross Profit"
                value={fmt(daily.totals.profit)}
                className={daily.totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}
              />
            </div>

            <div className="rounded-lg border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">
                  Units Sold
                  {daily.transactionCount > 0 && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      ({daily.transactionCount} transaction{daily.transactionCount !== 1 ? 's' : ''})
                    </span>
                  )}
                </h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Qty Sold</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Revenue</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cost</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.soldItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                        No sales recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {daily.soldItems.map((item) => (
                        <tr key={item.productId} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="px-4 py-2.5 font-medium">{item.name}</td>
                          <td className="px-4 py-2.5 text-right">{item.unitsSold}</td>
                          <td className="px-4 py-2.5 text-right">{fmt(item.revenue)}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(item.cost)}</td>
                          <td
                            className={`px-4 py-2.5 text-right font-medium ${item.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}
                          >
                            {fmt(item.profit)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/30 font-semibold">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right">{daily.totals.unitsSold}</td>
                        <td className="px-4 py-2.5 text-right">{fmt(daily.totals.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{fmt(daily.totals.cost)}</td>
                        <td
                          className={`px-4 py-2.5 text-right ${daily.totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}
                        >
                          {fmt(daily.totals.profit)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
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

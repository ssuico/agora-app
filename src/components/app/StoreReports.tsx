import { useEffect, useState } from 'react';

interface SummaryData {
  totalSales: number;
  totalCOGS: number;
  grossProfit: number;
  transactionCount: number;
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

  useEffect(() => {
    fetchSummary();
  }, [storeId]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Reports</h1>
        <p className="text-sm text-muted-foreground">Summary of store performance</p>
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

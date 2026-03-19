import { useEffect, useState } from 'react';
import { Package, RefreshCw, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductStat {
  productId: string;
  name: string;
  totalSold: number;
  totalRevenue: number;
}

interface TopProductsProps {
  storeId: string;
  /** When true, hides revenue figures (use in customer-facing views) */
  hideRevenue?: boolean;
  /** Override default limit options */
  defaultLimit?: 5 | 10;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const MEDAL_COLORS = [
  'bg-amber-400 text-amber-950',
  'bg-slate-300 text-slate-700',
  'bg-orange-400 text-orange-950',
];

export function TopProducts({ storeId, hideRevenue = false, defaultLimit = 10 }: TopProductsProps) {
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState<5 | 10>(defaultLimit);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/products/sold-stats?storeId=${storeId}&limit=${limit}`);
      if (!res.ok) throw new Error('Failed to load top products');
      setProducts(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading top products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [storeId, limit]);

  const maxSold = products[0]?.totalSold ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Top Products</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {([5, 10] as const).map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  limit === n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No sales data yet</p>
        </div>
      ) : (
        <div className="rounded-xl border  bg-card divide-y divide-border overflow-scroll">
          {products.map((product, index) => {
            const barWidth = maxSold > 0 ? Math.round((product.totalSold / maxSold) * 100) : 0;
            const rankClass = MEDAL_COLORS[index] ?? 'bg-muted text-muted-foreground';

            return (
              <div key={product.productId} className="flex items-center gap-4 px-4 py-4">
                {/* Rank badge */}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankClass}`}
                >
                  {index + 1}
                </div>

                {/* Product info + bar */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <p className="truncate text-sm font-medium">{product.name}</p>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      {product.totalSold.toLocaleString()} sold
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  {!hideRevenue && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmt(product.totalRevenue)} revenue
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

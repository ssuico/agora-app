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
    <div className="shop-widget">
      {/* Header */}
      <div className="shop-widget-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <h2 className="text-sm font-semibold">Top Products</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-md border overflow-hidden">
            {([5, 10] as const).map((n) => (
              <button
                key={n}
                onClick={() => setLimit(n)}
                className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  limit === n
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData} className="h-6 w-6">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="m-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Package className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <p className="text-xs text-muted-foreground">No sales data yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {products.map((product, index) => {
              const barWidth = maxSold > 0 ? Math.round((product.totalSold / maxSold) * 100) : 0;
              const rankClass = MEDAL_COLORS[index] ?? 'bg-muted text-muted-foreground';

              return (
                <div key={product.productId} className="flex items-center gap-3 px-2 py-3 rounded-lg transition-colors hover:bg-muted/20">
                  {/* Rank badge */}
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ${rankClass}`}
                  >
                    {index + 1}
                  </div>

                  {/* Product info + bar */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="truncate text-xs font-medium">{product.name}</p>
                      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {product.totalSold.toLocaleString()} sold
                      </span>
                    </div>
                    <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary/60 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    {!hideRevenue && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
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
    </div>
  );
}

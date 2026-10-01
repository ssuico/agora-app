import { useEffect, useState } from 'react';
import { AlertCircle, Package, RefreshCw, Trophy } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
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
  'bg-rating text-foreground',
  'bg-border text-foreground',
  'bg-warning-soft text-warning-ink',
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
      <div className="shop-widget-header flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-lg bg-warning-soft">
            <Trophy className="size-3.5 text-warning" />
          </div>
          <h2 className="text-sm font-semibold">Top Products</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded-md border">
            {([5, 10] as const).map((n) => (
              <Button
                key={n}
                variant="ghost"
                size="xs"
                onClick={() => setLimit(n)}
                aria-pressed={limit === n}
                className={`rounded-none text-[11px] ${limit === n ? 'bg-primary-subtle font-semibold text-foreground hover:bg-primary-subtle' : 'text-muted-foreground'}`}
              >
                Top {n}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon-xs" onClick={fetchData}>
            <RefreshCw />
          </Button>
        </div>
      </div>

      <div className="p-2">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-3 w-auto">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : products.length === 0 ? (
          <Empty className="py-10 md:py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Package />
              </EmptyMedia>
              <EmptyDescription className="text-xs">No sales data yet</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="divide-y divide-border/50">
            {products.map((product, index) => {
              const barWidth = maxSold > 0 ? Math.round((product.totalSold / maxSold) * 100) : 0;
              const rankClass = MEDAL_COLORS[index] ?? 'bg-muted text-muted-foreground';

              return (
                <div key={product.productId} className="flex items-center gap-3 px-2 py-3 rounded-lg transition-colors hover:bg-muted/20">
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ${rankClass}`}
                  >
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <p className="truncate text-xs font-medium">{product.name}</p>
                      <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
                        {product.totalSold.toLocaleString()} sold
                      </span>
                    </div>
                    <Progress value={barWidth} className="h-1" />
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

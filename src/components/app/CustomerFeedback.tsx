import { useEffect, useState } from 'react';
import { MessageSquare, RefreshCw, Star, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StarDistribution {
  1: number; 2: number; 3: number; 4: number; 5: number;
}

interface OverallStats {
  averageStars: number;
  totalCount: number;
  distribution: StarDistribution;
}

interface ProductStat {
  productId: string;
  productName: string;
  averageStars: number;
  totalCount: number;
}

interface FeedbackEntry {
  _id: string;
  type: 'product' | 'store';
  stars: number;
  comment: string;
  createdAt: string;
  customerId?: { name: string } | null;
  productId?: { name: string } | null;
}

interface AggregateData {
  product: {
    overall: OverallStats;
    perProduct: ProductStat[];
    recentFeedback: FeedbackEntry[];
  };
  store: {
    overall: OverallStats;
    recentFeedback: FeedbackEntry[];
  };
}

interface CustomerFeedbackProps {
  storeId: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function StarRow({ stars }: { stars: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= Math.round(stars) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}

function DistributionBar({ label, count, total }: { label: number; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-3 shrink-0 text-right text-muted-foreground">{label}</span>
      <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 shrink-0 text-right text-muted-foreground">{count}</span>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── sub-sections ──────────────────────────────────────────────────────────────

function OverallCard({ overall }: { overall: OverallStats }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
        <div className="text-center sm:text-left">
          <p className="text-5xl font-bold tabular-nums">
            {overall.totalCount > 0 ? overall.averageStars.toFixed(1) : '—'}
          </p>
          <div className="mt-1 flex justify-center sm:justify-start">
            <StarRow stars={overall.averageStars} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {overall.totalCount === 0
              ? 'No ratings yet'
              : `${overall.totalCount} rating${overall.totalCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex-1 space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((s) => (
            <DistributionBar key={s} label={s} count={overall.distribution[s]} total={overall.totalCount} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CommentList({ entries, emptyLabel }: { entries: FeedbackEntry[]; emptyLabel: string }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Recent Comments</h3>
      </div>
      {entries.length === 0 ? (
        <div className="py-10 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">{emptyLabel}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry._id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StarRow stars={entry.stars} />
                    <span className="text-xs font-medium">{entry.customerId?.name ?? 'Anonymous'}</span>
                    {entry.type === 'product' && entry.productId?.name && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {entry.productId.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm text-foreground">{entry.comment}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(entry.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function CustomerFeedback({ storeId }: CustomerFeedbackProps) {
  const [data, setData] = useState<AggregateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ratings/aggregates?storeId=${storeId}`);
      if (!res.ok) throw new Error('Failed to load feedback data');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [storeId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
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

  const { product, store } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Customer Feedback</h2>
        <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products" className="gap-1.5">
            <Star className="h-3.5 w-3.5" />
            Product Ratings
            {product.overall.totalCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {product.overall.totalCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="store" className="gap-1.5">
            <Store className="h-3.5 w-3.5" />
            Store Rating
            {store.overall.totalCount > 0 && (
              <span className="ml-1 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {store.overall.totalCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Product Ratings tab */}
        <TabsContent value="products" className="mt-4 space-y-4">
          <OverallCard overall={product.overall} />

          {product.perProduct.length > 0 && (
            <div className="rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <h3 className="text-sm font-semibold">Per-Product Breakdown</h3>
              </div>
              <div className="divide-y divide-border">
                {product.perProduct.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.totalCount} rating{p.totalCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center gap-2 shrink-0">
                      <StarRow stars={p.averageStars} />
                      <span className="text-sm font-semibold tabular-nums">{p.averageStars.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <CommentList entries={product.recentFeedback} emptyLabel="No product comments yet" />
        </TabsContent>

        {/* Store Rating tab */}
        <TabsContent value="store" className="mt-4 space-y-4">
          <OverallCard overall={store.overall} />
          <CommentList entries={store.recentFeedback} emptyLabel="No store comments yet" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

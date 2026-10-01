import { useEffect, useState } from 'react';
import { AlertCircle, MessageSquare, RefreshCw, Star, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
          className={`size-3.5 ${i <= Math.round(stars) ? 'fill-rating text-rating' : 'text-muted-foreground/30'}`}
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
      <Star className="size-3 shrink-0 fill-rating text-rating" />
      <Progress
        value={pct}
        className="h-1.5 flex-1 bg-muted [&>[data-slot=progress-indicator]]:bg-rating"
      />
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
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
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
        <div className="flex flex-1 flex-col gap-1.5">
          {([5, 4, 3, 2, 1] as const).map((s) => (
            <DistributionBar key={s} label={s} count={overall.distribution[s]} total={overall.totalCount} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CommentList({ entries, emptyLabel }: { entries: FeedbackEntry[]; emptyLabel: string }) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex items-center gap-2 px-4 py-3">
        <MessageSquare className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm">Recent Comments</CardTitle>
      </CardHeader>
      <Separator />
      {entries.length === 0 ? (
        <Empty className="p-6 md:p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquare />
            </EmptyMedia>
            <EmptyDescription>{emptyLabel}</EmptyDescription>
          </EmptyHeader>
        </Empty>
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
                      <Badge variant="secondary" className="text-[10px]">
                        {entry.productId.name}
                      </Badge>
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
    </Card>
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
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { product, store } = data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Customer Feedback</h2>
        <Button variant="ghost" size="sm" onClick={fetchData} className="text-xs">
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">
            <Star />
            Product Ratings
            {product.overall.totalCount > 0 && (
              <Badge variant="warning" className="ml-1 px-1.5 text-[10px] font-semibold">
                {product.overall.totalCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="store">
            <Store />
            Store Rating
            {store.overall.totalCount > 0 && (
              <Badge variant="info" className="ml-1 px-1.5 text-[10px] font-semibold">
                {store.overall.totalCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Product Ratings tab */}
        <TabsContent value="products" className="mt-4 flex flex-col gap-4">
          <OverallCard overall={product.overall} />

          {product.perProduct.length > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="px-4 py-3">
                <CardTitle className="text-sm">Per-Product Breakdown</CardTitle>
              </CardHeader>
              <Separator />
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
            </Card>
          )}

          <CommentList entries={product.recentFeedback} emptyLabel="No product comments yet" />
        </TabsContent>

        {/* Store Rating tab */}
        <TabsContent value="store" className="mt-4 flex flex-col gap-4">
          <OverallCard overall={store.overall} />
          <CommentList entries={store.recentFeedback} emptyLabel="No store comments yet" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

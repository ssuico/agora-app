import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, MessageSquare, RefreshCw, Star, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

interface ProductRater {
  _id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
  customerId: string | null;
  customerName: string;
  customerAvatar: string;
}

interface ProductStat {
  productId: string;
  productName: string;
  averageStars: number;
  totalCount: number;
  ratings: ProductRater[];
}

interface FeedbackEntry {
  _id: string;
  type: 'product' | 'store';
  stars: number;
  comment?: string | null;
  createdAt: string;
  customerId?: { name: string; avatar?: string } | null;
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
  const diff = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function RaterAvatar({ name, avatar }: { name: string; avatar?: string }) {
  return (
    <Avatar className="size-8 shrink-0">
      {avatar && <AvatarImage src={avatar} alt={name} className="object-cover" />}
      <AvatarFallback className="text-[10px] font-semibold">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

function RaterRow({
  name,
  avatar,
  stars,
  comment,
  createdAt,
  productName,
}: {
  name: string;
  avatar?: string;
  stars: number;
  comment?: string | null;
  createdAt: string;
  productName?: string;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <RaterAvatar name={name} avatar={avatar} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium">{name}</span>
          <StarRow stars={stars} />
          <span className="text-xs font-semibold tabular-nums">{stars}/5</span>
          {productName && (
            <Badge variant="secondary" className="text-[10px]">
              {productName}
            </Badge>
          )}
        </div>
        {comment ? (
          <p className="mt-1 text-sm text-foreground">{comment}</p>
        ) : (
          <p className="mt-1 text-xs italic text-muted-foreground">No comment left</p>
        )}
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(createdAt)}</span>
    </li>
  );
}

function RatingList({
  title,
  entries,
  emptyLabel,
  showProduct,
}: {
  title: string;
  entries: FeedbackEntry[];
  emptyLabel: string;
  showProduct?: boolean;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex items-center gap-2 px-4 py-3">
        <MessageSquare className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm">{title}</CardTitle>
        <Badge variant="secondary" className="px-1.5 text-[10px]">
          {entries.length}
        </Badge>
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
            <RaterRow
              key={entry._id}
              name={entry.customerId?.name ?? 'Deleted user'}
              avatar={entry.customerId?.avatar}
              stars={entry.stars}
              comment={entry.comment}
              createdAt={entry.createdAt}
              productName={showProduct ? (entry.productId?.name ?? 'Deleted product') : undefined}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProductBreakdownRow({ product }: { product: ProductStat }) {
  const [open, setOpen] = useState(false);
  const panelId = `product-raters-${product.productId}`;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{product.productName}</p>
          <p className="text-xs text-muted-foreground">
            {product.totalCount} rating{product.totalCount !== 1 ? 's' : ''} · tap to {open ? 'hide' : 'view'} raters
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StarRow stars={product.averageStars} />
          <span className="text-sm font-semibold tabular-nums">{product.averageStars.toFixed(1)}</span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <ul id={panelId} className="divide-y divide-border border-t border-border bg-muted/20">
          {product.ratings.map((r) => (
            <RaterRow
              key={r._id}
              name={r.customerName}
              avatar={r.customerAvatar}
              stars={r.stars}
              comment={r.comment}
              createdAt={r.createdAt}
            />
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('products');

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/ratings/aggregates?storeId=${storeId}`);
      if (!res.ok) throw new Error('Failed to load feedback data');
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading feedback');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [storeId]);

  const allProductEntries = useMemo<FeedbackEntry[]>(() => {
    if (!data) return [];
    return data.product.perProduct
      .flatMap((p) =>
        p.ratings.map((r) => ({
          _id: r._id,
          type: 'product' as const,
          stars: r.stars,
          comment: r.comment,
          createdAt: r.createdAt,
          customerId: { name: r.customerName, avatar: r.customerAvatar },
          productId: { name: p.productName },
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data]);

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="text-xs"
        >
          <RefreshCw data-icon="inline-start" className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
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
                  <ProductBreakdownRow key={p.productId} product={p} />
                ))}
              </div>
            </Card>
          )}

          <RatingList
            title="All Product Ratings"
            entries={allProductEntries}
            emptyLabel="No product ratings yet"
            showProduct
          />
        </TabsContent>

        {/* Store Rating tab */}
        <TabsContent value="store" className="mt-4 flex flex-col gap-4">
          <OverallCard overall={store.overall} />
          <RatingList
            title="All Store Ratings"
            entries={store.recentFeedback}
            emptyLabel="No store ratings yet"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

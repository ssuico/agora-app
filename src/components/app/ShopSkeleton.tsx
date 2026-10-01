import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ShopSkeletonProps {
  gridCols?: 3 | 6 | 9;
}

const GRID_CLASSES = {
  3: 'gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  6: 'gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  9: 'gap-2 grid-cols-3 sm:grid-cols-5 lg:grid-cols-9',
} as const;

const CARD_COUNT = { 3: 6, 6: 12, 9: 18 } as const;

function ProductCardSkeleton({ gridCols }: { gridCols: 3 | 6 | 9 }) {
  const isMini = gridCols === 9;
  const isCompact = gridCols === 6;

  return (
    <Card className="overflow-hidden p-0 gap-0">
      <Skeleton className={`w-full rounded-none ${isMini ? 'h-20' : isCompact ? 'h-32' : 'h-44'}`} />
      <CardContent className={`flex flex-col ${isMini ? 'p-1.5 gap-1' : isCompact ? 'p-2.5 gap-2' : 'p-3 gap-2'}`}>
        <Skeleton className={isMini ? 'h-2.5 w-4/5' : isCompact ? 'h-3 w-4/5' : 'h-4 w-3/4'} />
        {!isMini && <Skeleton className="h-3 w-1/3" />}
        <div className="flex items-end justify-between gap-1">
          <Skeleton className={isMini ? 'h-3 w-10' : isCompact ? 'h-4 w-14' : 'h-6 w-20'} />
          {!isMini && !isCompact && <Skeleton className="h-5 w-14 rounded-full" />}
        </div>
        {isMini ? (
          <Skeleton className="h-5 w-full rounded-lg" />
        ) : isCompact ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-2.5 w-5" />
              <Skeleton className="h-6 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-6 w-full rounded-lg" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-6" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-full rounded-xl" />
            <Skeleton className="h-7 w-full rounded-xl" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityWidgetSkeleton() {
  return (
    <div className="shop-widget">
      <div className="shop-widget-header flex items-center gap-2">
        <Skeleton className="size-6 rounded-lg" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5 pt-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopProductsWidgetSkeleton() {
  return (
    <div className="shop-widget">
      <div className="shop-widget-header flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded-lg" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <div className="divide-y divide-border/50 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-3">
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-2.5 w-10" />
              </div>
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShopSkeleton({ gridCols = 3 }: ShopSkeletonProps) {
  return (
    <div className="flex flex-col gap-5" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading shop…</span>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          <div className="shop-products-section">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 max-w-sm flex-1 rounded-xl" />
                <Skeleton className="h-10 w-28 shrink-0 rounded-xl" />
                <Skeleton className="hidden h-4 w-14 shrink-0 sm:block" />
              </div>
              <div className={`grid ${GRID_CLASSES[gridCols]}`}>
                {Array.from({ length: CARD_COUNT[gridCols] }).map((_, i) => (
                  <ProductCardSkeleton key={i} gridCols={gridCols} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden w-72 shrink-0 flex-col gap-4 xl:flex">
          <ActivityWidgetSkeleton />
          <TopProductsWidgetSkeleton />
        </div>
      </div>
    </div>
  );
}

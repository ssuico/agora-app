import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, Eye,
  Grid3x3, HelpCircle, ImageIcon, LayoutGrid, Lightbulb, MessageSquare,
  Minus, Package, PackageCheck, PackageX, Plus, QrCode, Search, ShoppingCart, Star, Store, Trash2, Wallet, X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';
import { ActivityFeed } from './ActivityFeed';
import { ShopSkeleton } from './ShopSkeleton';
import { TopProducts } from './TopProducts';

interface Product {
  _id: string;
  name: string;
  images: string[];
  sellingPrice: number;
  discountPrice?: number | null;
  stockQuantity: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface StockAlert {
  id: number;
  names: string[];
}

interface ProductRatingStat {
  averageStars: number;
  totalCount: number;
}

interface FeedbackEntry {
  _id: string;
  stars: number;
  comment?: string | null;
  createdAt: string;
  customerId?: { name: string } | null;
  productId?: { name: string; _id: string } | null;
  type: 'product' | 'store';
}

interface PaymentOption {
  _id: string;
  type: 'e-wallet' | 'bank';
  recipientName: string;
  qrImageUrl: string;
  label?: string;
  accountDetails?: string;
  isActive: boolean;
}

interface ShopViewProps {
  storeId: string;
  storeName: string;
  initialIsOpen?: boolean;
  initialIsMaintenance?: boolean;
  bannerUrl?: string;
}

function StoreBanner({ src, storeName }: { src: string; storeName: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="aspect-[3/1] w-full overflow-hidden rounded-xl border border-border bg-muted sm:aspect-[4/1]">
      <img
        src={src}
        alt={`${storeName} banner`}
        className="size-full object-cover"
        fetchPriority="high"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

const getEffectivePrice = (product: Product) => {
  if (typeof product.discountPrice !== 'number') return product.sellingPrice;
  return Math.min(product.discountPrice, product.sellingPrice);
};

const getDiscountPercent = (product: Product) => {
  const effectivePrice = getEffectivePrice(product);
  if (product.sellingPrice <= 0 || effectivePrice >= product.sellingPrice) return 0;
  return Math.round(((product.sellingPrice - effectivePrice) / product.sellingPrice) * 100);
};

let alertCounter = 0;

// ---------------------------------------------------------------------------
// Shared image helpers
// ---------------------------------------------------------------------------

function ImagePlaceholder({ className, iconSize = 'size-8' }: { className?: string; iconSize?: string }) {
  return (
    <div className={`flex items-center justify-center bg-muted ${className}`}>
      <ImageIcon className={`${iconSize} text-muted-foreground/30`} />
    </div>
  );
}

function SafeImage({ src, alt, className, onError }: { src: string; alt: string; className?: string; onError: () => void }) {
  return <img src={src} alt={alt} className={`object-cover ${className}`} onError={onError} />;
}

function ImageCarousel({ images, className, onClick }: { images: string[]; className?: string; onClick?: () => void }) {
  const [index, setIndex] = useState(0);
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());
  const validImages = images.filter((_, i) => !failedSet.has(i));
  const hasMultiple = validImages.length > 1;
  const total = images.length;

  const markFailed = useCallback((i: number) => {
    setFailedSet((prev) => new Set(prev).add(i));
  }, []);

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i - 1 + total) % total);
  };
  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex((i) => (i + 1) % total);
  };
  const goTo = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setIndex(i);
  };

  if (!images.length || validImages.length === 0) {
    return (
      <div onClick={onClick} className="cursor-pointer">
        <ImagePlaceholder className={className} />
      </div>
    );
  }

  return (
    <div className={`relative group ${className} overflow-hidden`} onClick={onClick}>
      {failedSet.has(index) ? (
        <ImagePlaceholder className="h-full w-full" />
      ) : (
        <SafeImage src={images[index]} alt="" className="h-full w-full" onError={() => markFailed(index)} />
      )}

      {hasMultiple && (
        <>
          <Button variant="secondary" size="icon-xs" onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100">
            <ChevronLeft />
          </Button>
          <Button variant="secondary" size="icon-xs" onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100">
            <ChevronRight />
          </Button>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button key={i} onClick={(e) => goTo(i, e)} className={`h-1.5 rounded-full transition-all ${i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}`} />
            ))}
          </div>
          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {index + 1}/{total}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quantity picker
// ---------------------------------------------------------------------------

function QuantityPicker({ value, max, onChange, size = 'sm' }: { value: number; max: number; onChange: (qty: number) => void; size?: 'sm' | 'md' }) {
  const btnSize = size === 'md' ? 'icon-sm' : 'icon-xs';
  const textSize = size === 'md' ? 'text-lg w-10' : 'text-sm w-8';
  return (
    <div className="flex items-center gap-1.5">
      <Button type="button" variant="outline" size={btnSize} aria-label="Decrease quantity" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}>
        <Minus />
      </Button>
      <span className={`${textSize} text-center font-semibold text-foreground`}>{value}</span>
      <Button type="button" variant="outline" size={btnSize} aria-label="Increase quantity" className="border-primary/40 text-primary hover:bg-primary-subtle/60 hover:text-primary" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>
        <Plus />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Star display
// ---------------------------------------------------------------------------

function MiniStars({ value, count }: { value: number; count: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`size-3 ${s <= Math.round(value) ? 'fill-rating text-rating' : 'text-muted-foreground/30'}`}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {value.toFixed(1)} ({count})
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Product detail dialog
// ---------------------------------------------------------------------------

function ProductDetailDialog({ product, open, onOpenChange, inCart, onAddToCart, isCooldown, rating, reviews }: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inCart?: CartItem;
  onAddToCart: (p: Product, qty: number) => void;
  isCooldown?: boolean;
  rating?: ProductRatingStat;
  reviews?: FeedbackEntry[];
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setSelectedIndex(0);
    setFailedSet(new Set());
    setQty(1);
  }, [product?._id]);

  if (!product) return null;

  const images = product.images ?? [];
  const hasImages = images.length > 0;
  const cartQty = inCart?.quantity ?? 0;
  const available = product.stockQuantity - cartQty;
  const isOOS = product.stockQuantity === 0;
  const effectivePrice = getEffectivePrice(product);
  const discountPercent = getDiscountPercent(product);
  const sortedReviews = reviews
    ? [...reviews].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const reviewCount = rating?.totalCount ?? sortedReviews.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl h-[82vh] overflow-hidden p-0 gap-0">
        <div className="grid h-full grid-cols-1 md:grid-cols-[3fr_2fr] overflow-hidden">

          {/* ── Left: Image panel ── */}
          <div className="flex flex-col border-b md:border-b-0 md:border-r bg-muted/40 overflow-hidden">
            {/* Image fills fixed column height */}
            <div className="relative min-h-52 md:min-h-0 md:flex-1 overflow-hidden bg-muted/30 flex items-center justify-center">
              {!hasImages || failedSet.has(selectedIndex) ? (
                <ImagePlaceholder className="h-full w-full" iconSize="size-12" />
              ) : (
                <SafeImage
                  src={images[selectedIndex]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                  onError={() => setFailedSet((prev) => new Set(prev).add(selectedIndex))}
                />
              )}

              {discountPercent > 0 && (
                <Badge variant="success" className="absolute left-2.5 top-2.5 text-[11px] font-bold shadow-sm">
                  -{discountPercent}%
                </Badge>
              )}

              {isOOS && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                  <Badge variant="destructive" className="px-3 py-1.5 text-sm font-semibold">
                    All Reserved
                  </Badge>
                </div>
              )}

              {images.length > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setSelectedIndex((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setSelectedIndex((i) => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full"
                  >
                    <ChevronRight />
                  </Button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div className="flex shrink-0 gap-2 overflow-x-auto p-2.5 bg-card/70 border-t border-border/50">
                {images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`size-11 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                      i === selectedIndex
                        ? 'border-primary shadow-sm'
                        : 'border-transparent opacity-50 hover:opacity-100 hover:border-border'
                    }`}
                  >
                    {failedSet.has(i) ? (
                      <ImagePlaceholder className="h-full w-full" iconSize="size-3" />
                    ) : (
                      <SafeImage
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={() => setFailedSet((prev) => new Set(prev).add(i))}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Details panel (scrollable) ── */}
          <div className="relative flex h-full flex-col overflow-y-auto">
            {/* ① Product info */}
            <div className="flex flex-col gap-4 px-6 pt-6 pr-14 pb-5">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold leading-snug">{product.name}</DialogTitle>
                <DialogDescription className="sr-only">Product details and reviews</DialogDescription>
              </DialogHeader>

              {/* Price */}
              <div className="flex items-end gap-3">
                <p className="text-4xl font-bold text-foreground leading-none">{fmt(effectivePrice)}</p>
                {discountPercent > 0 && (
                  <div className="mb-0.5 flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground line-through leading-none">{fmt(product.sellingPrice)}</span>
                    <span className="text-[11px] font-semibold text-success leading-none">{discountPercent}% off</span>
                  </div>
                )}
              </div>

              {/* Stock + in-cart badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={isOOS ? 'error' : product.stockQuantity < 10 ? 'warning' : 'operational'}>
                  {isOOS ? <PackageX /> : product.stockQuantity < 10 ? <AlertTriangle /> : <PackageCheck />}
                  {isOOS ? 'All Reserved' : product.stockQuantity < 10 ? `Low stock · ${product.stockQuantity} left` : `${product.stockQuantity} in stock`}
                </Badge>
                {cartQty > 0 && (
                  <Badge variant="outline" className="border-primary/40 bg-primary-subtle text-foreground">
                    <ShoppingCart />
                    {cartQty} in cart
                  </Badge>
                )}
              </div>

              {/* Rating + rate link */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  {rating && rating.totalCount > 0
                    ? <MiniStars value={rating.averageStars} count={rating.totalCount} />
                    : <p className="text-xs text-muted-foreground">No ratings yet</p>
                  }
                </div>
                <Button asChild variant="outline" size="xs" className="rounded-full">
                  <a href={`/products/${product._id}/rate`}>
                    <Star data-icon="inline-start" />
                    Rate product
                  </a>
                </Button>
              </div>
            </div>

            <Separator />

            {/* ② Add to cart */}
            <div className="px-6 py-5">
              {isOOS ? (
                <Alert variant="destructive" className="text-center">
                  <AlertCircle />
                  <AlertTitle>Fully reserved</AlertTitle>
                  <AlertDescription>Check back later for availability.</AlertDescription>
                </Alert>
              ) : available > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-base text-muted-foreground">Quantity</span>
                    <QuantityPicker value={qty} max={available} onChange={setQty} size="md" />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-base text-muted-foreground">Subtotal</span>
                    <span className="text-2xl font-bold">{fmt(effectivePrice * qty)}</span>
                  </div>
                  <Button
                    className="w-full rounded-xl h-12 text-base"
                    size="lg"
                    onClick={() => { onAddToCart(product, qty); setQty(1); }}
                    disabled={isCooldown}
                  >
                    {isCooldown ? (
                      <><Spinner data-icon="inline-start" />Added!</>
                    ) : (
                      <><ShoppingCart data-icon="inline-start" />Add {qty > 1 ? `${qty} × ` : ''}to Cart</>
                    )}
                  </Button>
                </div>
              ) : (
                <p className="py-3 text-center text-sm text-muted-foreground">All available stock is already in your cart.</p>
              )}
            </div>

            <Separator />

            {/* ③ Customer Reviews */}
            <div className="pb-4">
              <div className="flex items-center justify-between px-6 py-4">
                <h4 className="flex items-center gap-2 text-sm font-semibold">
                  <Star className="size-4 fill-rating text-rating" />
                  Customer Reviews
                </h4>
                <span className="text-xs text-muted-foreground">
                  {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
                </span>
              </div>

              {sortedReviews.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {sortedReviews.map((r) => (
                    <li key={r._id} className="px-6 py-4 transition-colors hover:bg-muted/20">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`size-3 ${s <= r.stars ? 'fill-rating text-rating' : 'text-muted-foreground/20'}`}
                            />
                          ))}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {r.comment ? (
                        <p className="wrap-break-word text-xs leading-relaxed text-foreground">{r.comment}</p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">No comment provided.</p>
                      )}
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground">— {r.customerId?.name ?? 'Anonymous'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyDescription>No reviews yet for this product.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main ShopView
// ---------------------------------------------------------------------------

export function ShopView({ storeId, storeName, initialIsOpen = true, initialIsMaintenance = false, bannerUrl }: ShopViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [reservationNotes, setReservationNotes] = useState('');
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [addToCartCooldowns, setAddToCartCooldowns] = useState<Set<string>>(new Set());
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridCols, setGridCols] = useState<3 | 6 | 9>(3);
  const [isStoreOpen, setIsStoreOpen] = useState(initialIsOpen);
  const [isMaintenance, setIsMaintenance] = useState(initialIsMaintenance);

  const [productRatings, setProductRatings] = useState<Map<string, ProductRatingStat>>(new Map());
  const [productReviews, setProductReviews] = useState<Map<string, FeedbackEntry[]>>(new Map());
  const [myRatedProductIds, setMyRatedProductIds] = useState<Set<string>>(new Set());

  const [storeRatingOpen, setStoreRatingOpen] = useState(false);
  const [storeRatingStars, setStoreRatingStars] = useState(5);
  const [storeRatingComment, setStoreRatingComment] = useState('');
  const [storeRatingSubmitting, setStoreRatingSubmitting] = useState(false);
  const [hasRatedStore, setHasRatedStore] = useState(false);
  const [existingStoreStars, setExistingStoreStars] = useState<number | null>(null);

  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionType, setInteractionType] = useState<'question' | 'recommendation'>('question');
  const [interactionContent, setInteractionContent] = useState('');
  const [interactionSubmitting, setInteractionSubmitting] = useState(false);
  const [interactionDone, setInteractionDone] = useState(false);

  const [paymentOptionsOpen, setPaymentOptionsOpen] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([]);
  const [paymentOptionsLoading, setPaymentOptionsLoading] = useState(false);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<PaymentOption | null>(null);

  const dismissAlert = (id: number) => {
    setStockAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const [availableProductIds, setAvailableProductIds] = useState<Set<string> | null>(null);

  // --- Data fetching ---

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products?storeId=${storeId}&dailyOnly=true`);
      if (res.ok) {
        const data: Product[] = await res.json();
        setProducts(data);
        setAvailableProductIds(new Set(data.map((p) => p._id)));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const fetchRatingAggregates = async () => {
    try {
      const res = await fetch(`/api/ratings/aggregates?storeId=${storeId}`);
      if (!res.ok) return;
      const data = await res.json();
      const productSection = data.product ?? {};
      const ratingsMap = new Map<string, ProductRatingStat>();
      const reviewsMap = new Map<string, FeedbackEntry[]>();
      if (Array.isArray(productSection.perProduct)) {
        for (const p of productSection.perProduct) {
          ratingsMap.set(String(p.productId), { averageStars: p.averageStars, totalCount: p.totalCount });
        }
      }
      if (Array.isArray(productSection.recentFeedback)) {
        for (const entry of productSection.recentFeedback as FeedbackEntry[]) {
          if (entry.productId?._id) {
            const pid = String(entry.productId._id);
            const arr = reviewsMap.get(pid) ?? [];
            arr.push(entry);
            reviewsMap.set(pid, arr);
          }
        }
      }
      setProductRatings(ratingsMap);
      setProductReviews(reviewsMap);
    } catch { /* ignore */ }
  };

  const fetchMyStoreRating = async () => {
    try {
      const res = await fetch(`/api/ratings/my-store-rating?storeId=${storeId}`);
      if (!res.ok) return;
      const data = await res.json() as { rating: { stars: number } | null };
      if (data.rating) {
        setHasRatedStore(true);
        setExistingStoreStars(data.rating.stars);
        setStoreRatingStars(data.rating.stars);
      }
    } catch { /* ignore */ }
  };

  const openPaymentOptions = async () => {
    setPaymentOptionsOpen(true);
    setSelectedPaymentOption(null);
    if (paymentOptions.length > 0) return;
    setPaymentOptionsLoading(true);
    try {
      const res = await fetch(`/api/payment-options/store/${storeId}/active`);
      if (res.ok) {
        const data: PaymentOption[] = await res.json();
        setPaymentOptions(data);
        if (data.length > 0) setSelectedPaymentOption(data[0]);
      }
    } catch { /* ignore */ } finally {
      setPaymentOptionsLoading(false);
    }
  };

  const fetchMyProductRatings = async () => {
    try {
      const res = await fetch('/api/ratings/my-product-ratings');
      if (!res.ok) return;
      const data = await res.json() as Array<{ productId: string }>;
      if (Array.isArray(data)) setMyRatedProductIds(new Set(data.map((r) => r.productId)));
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchProducts(); fetchRatingAggregates(); fetchMyStoreRating(); fetchMyProductRatings(); }, []);

  // --- Socket: real-time stock updates ---

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:store', storeId);

    const handleStockUpdate = (updatedProducts: Product[]) => {
      setProducts((prev) => {
        const currentIds = availableProductIds ?? new Set(prev.map((p) => p._id));
        return updatedProducts.filter((p) => currentIds.has(p._id));
      });

      const productMap = new Map(updatedProducts.map((p) => [p._id, p]));

      setCart((prevCart) => {
        const affectedNames: string[] = [];
        const newCart = prevCart.map((item) => {
          const latest = productMap.get(item.product._id);
          if (!latest) return item;
          if (latest.stockQuantity < item.product.stockQuantity) {
            if (latest.stockQuantity === 0) {
              affectedNames.push(item.product.name);
            } else if (latest.stockQuantity < item.quantity) {
              affectedNames.push(item.product.name);
            }
          }
          return { ...item, product: latest };
        });

        if (affectedNames.length > 0) {
          const id = ++alertCounter;
          setStockAlerts((prev) => [...prev, { id, names: affectedNames }]);
          setTimeout(() => dismissAlert(id), 8000);
        }

        return newCart;
      });

      setSelectedProduct((prev) => {
        if (!prev) return null;
        const latest = productMap.get(prev._id);
        return latest ?? prev;
      });
    };

    const handleStatusChange = (data: { storeId: string; isOpen: boolean }) => {
      if (data.storeId === storeId) setIsStoreOpen(data.isOpen);
    };

    const handleMaintenanceChange = (data: { storeId: string; isMaintenance: boolean }) => {
      if (data.storeId === storeId) setIsMaintenance(data.isMaintenance);
    };

    socket.on('stock:updated', handleStockUpdate);
    socket.on('store:status-changed', handleStatusChange);
    socket.on('store:maintenance-changed', handleMaintenanceChange);
    return () => {
      socket.off('stock:updated', handleStockUpdate);
      socket.off('store:status-changed', handleStatusChange);
      socket.off('store:maintenance-changed', handleMaintenanceChange);
      socket.emit('leave:store', storeId);
    };
  }, [storeId, availableProductIds]);

  // --- Cart helpers ---

  const addToCartWithQty = (product: Product, qty: number) => {
    if (addToCartCooldowns.has(product._id)) return;

    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id);
      if (existing) {
        const newQty = Math.min(existing.quantity + qty, product.stockQuantity);
        return prev.map((c) => c.product._id === product._id ? { ...c, quantity: newQty } : c);
      }
      return [...prev, { product, quantity: Math.min(qty, product.stockQuantity) }];
    });
    setCardQuantities((prev) => ({ ...prev, [product._id]: 1 }));

    toast.success(`Added ${qty} × "${product.name}" to cart`);

    setAddToCartCooldowns((prev) => new Set(prev).add(product._id));
    setTimeout(() => {
      setAddToCartCooldowns((prev) => {
        const next = new Set(prev);
        next.delete(product._id);
        return next;
      });
    }, 3000);
  };

  const updateCartQuantity = (productId: string, newQty: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product._id !== productId) return c;
        const clamped = Math.max(1, Math.min(newQty, c.product.stockQuantity));
        return { ...c, quantity: clamped };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product._id !== productId));
  };

  const clearAllCart = () => {
    setCart([]);
    setCardQuantities({});
    toast.success('Cart cleared');
  };

  const removeUnavailableFromCart = () => {
    setCart((prev) => prev.filter((c) => c.product.stockQuantity > 0));
  };

  const cartTotal = cart.reduce((sum, c) => sum + getEffectivePrice(c.product) * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const unavailableItems = cart.filter((c) => c.product.stockQuantity === 0);
  const hasUnavailable = unavailableItems.length > 0;
  const validCartTotal = cart
    .filter((c) => c.product.stockQuantity > 0)
    .reduce((sum, c) => sum + getEffectivePrice(c.product) * c.quantity, 0);

  const getCartItem = (productId: string) => cart.find((c) => c.product._id === productId);
  const getCardQty = (productId: string) => cardQuantities[productId] ?? 1;
  const setCardQty = (productId: string, qty: number) => {
    setCardQuantities((prev) => ({ ...prev, [productId]: qty }));
  };
  const getAvailable = (product: Product) => {
    const cartQty = getCartItem(product._id)?.quantity ?? 0;
    return product.stockQuantity - cartQty;
  };

  // --- Reserve / checkout ---

  const handleCheckout = async () => {
    const validItems = cart.filter((c) => c.product.stockQuantity > 0);
    if (validItems.length === 0) return;
    setCheckoutLoading(true);
    setError('');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          items: validItems.map((c) => ({ productId: c.product._id, quantity: c.quantity })),
          ...(reservationNotes.trim() && { customerNotes: reservationNotes.trim() }),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        const msg = data.message ?? 'Reservation failed';
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success('Reservation placed!');
      setCart([]);
      setCartOpen(false);
      setSuccessOpen(true);
      setCardQuantities({});
      setReservationNotes('');
      await fetchProducts();
    } catch {
      setError('Network error');
      toast.error('Network error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const filteredProducts = products
    .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aInStock = a.stockQuantity > 0 ? 0 : 1;
      const bInStock = b.stockQuantity > 0 ? 0 : 1;
      if (aInStock !== bInStock) return aInStock - bInStock;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

  // --- Special states ---

  if (isMaintenance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Empty className="w-full max-w-md flex-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle className="text-2xl font-bold">Under Maintenance</EmptyTitle>
            <EmptyDescription>
              <span className="font-semibold text-foreground">{storeName}</span> is temporarily unavailable.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Alert className="text-left">
              <Clock />
              <AlertTitle>Maintenance in progress</AlertTitle>
              <AlertDescription>We apologize for the inconvenience. Please check back soon.</AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="rounded-full px-6">
              <a href="/purchases"><Package data-icon="inline-start" />My Purchases</a>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (!isStoreOpen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Empty className="w-full max-w-md flex-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Store />
            </EmptyMedia>
            <EmptyTitle className="text-2xl font-bold">Store Closed</EmptyTitle>
            <EmptyDescription>
              <span className="font-semibold text-foreground">{storeName}</span> is not accepting reservations right now.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Alert className="text-left">
              <Clock />
              <AlertTitle className="line-clamp-none">The store manager has closed this store for the day.</AlertTitle>
              <AlertDescription>Please check back tomorrow.</AlertDescription>
            </Alert>
            <Button asChild variant="outline" className="rounded-full px-6">
              <a href="/purchases"><Package data-icon="inline-start" />My Purchases</a>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  if (loading) {
    return <ShopSkeleton gridCols={gridCols} />;
  }

  // --- Main render ---

  return (
    <div className="flex flex-col gap-5">

      {/* Stock alerts */}
      {stockAlerts.map((alert) => (
        <Alert key={alert.id} className="animate-in slide-in-from-top-2 pr-12">
          <AlertTriangle />
          <AlertTitle>Stock updated by another reservation</AlertTitle>
          <AlertDescription>
            <p>
              {alert.names.length === 1
                ? `"${alert.names[0]}" has limited or no stock remaining.`
                : `${alert.names.length} items have limited stock: ${alert.names.map((n) => `"${n}"`).join(', ')}.`}
              {' '}Please review your cart.
            </p>
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => dismissAlert(alert.id)}
            className="absolute right-2 top-2"
          >
            <X />
          </Button>
        </Alert>
      ))}

      {bannerUrl && <StoreBanner src={bannerUrl} storeName={storeName} />}

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{storeName}</h1>
            <Badge variant="success" className="px-2.5 py-1 font-semibold">
              <span className="size-1.5 rounded-full bg-current animate-pulse" />
              Open
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Browse and reserve items — pay when you claim</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" asChild className="rounded-full text-xs">
            <a href="/purchases">
              <Package data-icon="inline-start" />
              My Purchases
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={openPaymentOptions} className="rounded-full text-xs">
            <QrCode data-icon="inline-start" />
            Scan to Pay
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setInteractionOpen(true); setInteractionDone(false); }}
            className="rounded-full text-xs"
          >
            <MessageSquare data-icon="inline-start" />
            Ask / Suggest
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStoreRatingOpen(true)}
            className={`rounded-full text-xs ${hasRatedStore ? 'border-warning/40 bg-warning-soft text-warning-ink hover:bg-warning-soft/70' : ''}`}
          >
            <Star data-icon="inline-start" className={hasRatedStore ? 'fill-rating text-rating' : ''} />
            {hasRatedStore ? `${existingStoreStars}★ Rated` : 'Rate Store'}
          </Button>
          {/* Desktop cart button — hidden when FAB is visible */}
          <Button
            variant={cartCount > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCartOpen(true)}
            className="relative rounded-full text-xs"
          >
            <ShoppingCart data-icon="inline-start" />
            Cart
            {cartCount > 0 && (
              <Badge
                variant={hasUnavailable ? 'destructive' : 'secondary'}
                data-icon="inline-end"
                className="h-4 min-w-4 px-1 py-0 text-[10px] leading-none"
              >
                {cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex gap-6 items-start">
        <div className="min-w-0 flex-1">
        <div className="shop-products-section">
          {/* Dot-grid texture layer */}
          <div className="shop-products-bg" aria-hidden="true" />

          <div className="flex flex-col gap-4">
          {/* Search + grid controls */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>

            <div className="flex items-center rounded-xl border border-border bg-card p-1 gap-0.5 shrink-0">
              {([
                { cols: 3 as const, icon: <LayoutGrid /> },
                { cols: 6 as const, icon: <Grid3x3 /> },
                { cols: 9 as const, icon: <Grid3x3 /> },
              ]).map(({ cols, icon }) => (
                <Button
                  key={cols}
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setGridCols(cols)}
                  title={`${cols} columns`}
                  aria-label={`${cols} columns`}
                  aria-pressed={gridCols === cols}
                  className={`rounded-lg ${gridCols === cols ? 'bg-primary-subtle text-primary hover:bg-primary-subtle' : 'text-muted-foreground'}`}
                >
                  {icon}
                </Button>
              ))}
            </div>

            {filteredProducts.length > 0 && (
              <span className="hidden sm:block shrink-0 text-xs text-muted-foreground">
                {filteredProducts.length} item{filteredProducts.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Product grid */}
          {filteredProducts.length === 0 ? (
            <Empty className="py-24">
              {searchQuery ? (
                <>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Search />
                    </EmptyMedia>
                    <EmptyTitle>No results for &ldquo;{searchQuery}&rdquo;</EmptyTitle>
                    <EmptyDescription>Try a different search term.</EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="rounded-full">
                      Clear search
                    </Button>
                  </EmptyContent>
                </>
              ) : (
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingCart />
                  </EmptyMedia>
                  <EmptyTitle>No products available</EmptyTitle>
                  <EmptyDescription>This store hasn't listed any products yet.</EmptyDescription>
                </EmptyHeader>
              )}
            </Empty>
          ) : (
            <div
              className={`grid transition-all ${
                gridCols === 3 ? 'gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
                gridCols === 6 ? 'gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' :
                                 'gap-2 grid-cols-3 sm:grid-cols-5 lg:grid-cols-9'
              }`}
            >
              {filteredProducts.map((product) => {
                const available = getAvailable(product);
                const cardQty = getCardQty(product._id);
                const inCart = getCartItem(product._id);
                const isOOS = product.stockQuantity === 0;
                const effectivePrice = getEffectivePrice(product);
                const discountPercent = getDiscountPercent(product);
                const isCompact = gridCols === 6;
                const isMini = gridCols === 9;
                const hasRated = myRatedProductIds.has(product._id);
                const rating = productRatings.get(product._id);

                return (
                  <Card
                    key={product._id}
                    className={`group overflow-hidden p-0 gap-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isOOS ? 'opacity-60' : ''} ${inCart && !isOOS ? 'border-primary/50 bg-primary-subtle/20' : ''}`}
                  >
                    {/* Image */}
                    <div className="relative overflow-hidden bg-muted/30">
                      <ImageCarousel
                        images={product.images ?? []}
                        className={`w-full cursor-pointer object-cover ${isMini ? 'h-20' : isCompact ? 'h-32' : 'h-44'}`}
                        onClick={() => setSelectedProduct(product)}
                      />

                      {/* Discount badge */}
                      {!isMini && discountPercent > 0 && (
                        <Badge variant="success" className="absolute left-2 top-2 text-[10px] font-bold shadow-sm px-1.5 py-0.5">
                          -{discountPercent}%
                        </Badge>
                      )}

                      {/* OOS overlay */}
                      {isOOS && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                          <Badge variant="destructive" className={`font-semibold shadow-sm ${isMini ? 'text-[9px] px-1.5 py-0.5' : 'text-xs'}`}>
                            {isMini ? 'OOS' : 'All Reserved'}
                          </Badge>
                        </div>
                      )}

                      {/* View hover overlay */}
                      {!isOOS && !isMini && (
                        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                            <Eye className={isCompact ? 'size-2.5' : 'size-3'} />
                            {isCompact ? 'Reviews' : 'View reviews'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <CardContent className={`flex flex-col ${isMini ? 'p-1.5 gap-1' : isCompact ? 'p-2.5 gap-2' : 'p-3 gap-2'}`}>
                      {/* Name */}
                      <button className="text-left" onClick={() => setSelectedProduct(product)}>
                        <h3 className={`font-semibold ${isOOS ? 'text-muted-foreground' : 'text-foreground'} ${isMini ? 'text-[10px] line-clamp-1' : isCompact ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2 leading-snug'}`}>
                          {product.name}
                        </h3>
                      </button>

                      {/* Stars (normal + compact) */}
                      {!isMini && rating && rating.totalCount > 0 && (
                        <MiniStars value={rating.averageStars} count={rating.totalCount} />
                      )}

                      {/* Price + stock row */}
                      <div className="flex items-end justify-between gap-1">
                        <div>
                          <p className={`font-bold ${isOOS ? 'text-muted-foreground' : 'text-foreground'} ${isMini ? 'text-[10px]' : isCompact ? 'text-sm' : 'text-xl'}`}>
                            {fmt(effectivePrice)}
                          </p>
                          {!isMini && discountPercent > 0 && (
                            <p className="text-xs text-muted-foreground line-through">{fmt(product.sellingPrice)}</p>
                          )}
                        </div>

                        {!isMini && !isCompact && (
                          <Badge
                            variant={isOOS ? 'error' : product.stockQuantity < 10 ? 'warning' : 'operational'}
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            {isOOS ? <PackageX /> : product.stockQuantity < 10 ? <AlertTriangle /> : <PackageCheck />}
                            {isOOS ? 'Reserved' : product.stockQuantity < 10 ? `Low · ${product.stockQuantity} left` : `${product.stockQuantity} left`}
                          </Badge>
                        )}
                      </div>

                      {/* In-cart note */}
                      {!isCompact && !isMini && inCart && (
                        <p className={`text-xs font-medium ${isOOS ? 'text-error' : 'text-foreground'}`}>
                          {inCart.quantity} in cart{isOOS ? ' (unavailable)' : ''}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="flex flex-col gap-1.5">
                        {isMini ? (
                          <div className="flex gap-1">
                            <Button
                              variant={isOOS || available === 0 ? 'secondary' : 'default'}
                              size="xs"
                              onClick={() => setSelectedProduct(product)}
                              className="flex-1 rounded-lg"
                            >
                              <ShoppingCart />
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              size="icon-xs"
                              className={`w-auto rounded-lg px-1.5 ${hasRated ? 'border-warning/40 bg-warning-soft text-warning-ink' : 'text-muted-foreground'}`}
                            >
                              <a href={`/products/${product._id}/rate`}>
                                <Star className={hasRated ? 'fill-rating text-rating' : ''} />
                              </a>
                            </Button>
                          </div>
                        ) : isCompact ? (
                          <>
                            {isOOS ? (
                              <p className="text-center text-[10px] text-muted-foreground py-0.5">Unavailable</p>
                            ) : available > 0 ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">Qty</span>
                                  <QuantityPicker value={Math.min(cardQty, available)} max={available} onChange={(q) => setCardQty(product._id, q)} />
                                </div>
                                <Button
                                  className="w-full rounded-lg h-7"
                                  size="xs"
                                  onClick={() => addToCartWithQty(product, Math.min(cardQty, available))}
                                  disabled={addToCartCooldowns.has(product._id)}
                                >
                                  {addToCartCooldowns.has(product._id)
                                    ? <><Spinner data-icon="inline-start" />Added!</>
                                    : <><ShoppingCart data-icon="inline-start" />Add</>
                                  }
                                </Button>
                              </>
                            ) : (
                              <p className="text-center text-[10px] text-muted-foreground py-0.5">In cart</p>
                            )}
                            <Button
                              asChild
                              variant="outline"
                              size="xs"
                              className={`w-full rounded-lg text-[10px] ${hasRated ? 'border-warning/40 bg-warning-soft text-warning-ink hover:bg-warning-soft/70' : 'text-muted-foreground'}`}
                            >
                              <a href={`/products/${product._id}/rate`}>
                                <Star data-icon="inline-start" className={hasRated ? 'fill-rating text-rating' : ''} />
                                Rate
                              </a>
                            </Button>
                          </>
                        ) : (
                          /* Normal (3-col) */
                          <>
                            {isOOS ? (
                              inCart ? (
                                <Alert variant="destructive" className="px-2 py-2 text-center">
                                  <AlertTitle className="text-xs">No longer available</AlertTitle>
                                </Alert>
                              ) : (
                                <p className="py-1 text-center text-xs text-muted-foreground">Currently unavailable</p>
                              )
                            ) : available > 0 ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Qty</span>
                                  <QuantityPicker value={Math.min(cardQty, available)} max={available} onChange={(q) => setCardQty(product._id, q)} />
                                </div>
                                <Button
                                  className="w-full rounded-xl"
                                  size="sm"
                                  onClick={() => addToCartWithQty(product, Math.min(cardQty, available))}
                                  disabled={addToCartCooldowns.has(product._id)}
                                >
                                  {addToCartCooldowns.has(product._id) ? (
                                    <><Spinner data-icon="inline-start" />Added!</>
                                  ) : (
                                    <><ShoppingCart data-icon="inline-start" />Add to Cart</>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <p className="py-1 text-center text-xs text-muted-foreground">All stock in cart</p>
                            )}
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className={`w-full rounded-xl text-xs ${hasRated ? 'border-warning/40 bg-warning-soft text-warning-ink hover:bg-warning-soft/70' : 'text-muted-foreground'}`}
                            >
                              <a href={`/products/${product._id}/rate`}>
                                <Star data-icon="inline-start" className={hasRated ? 'fill-rating text-rating' : ''} />
                                {hasRated ? 'View My Rating' : 'Rate Product'}
                              </a>
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </div>{/* end gap-4 */}
        </div>{/* end shop-products-section */}
        </div>{/* end flex-1 */}

        {/* Right sidebar */}
        <div className="hidden xl:flex w-72 shrink-0 flex-col gap-4">
          <ActivityFeed storeId={storeId} />
          <TopProducts storeId={storeId} hideRevenue defaultLimit={5} />
        </div>
      </div>

      {/* ── Floating cart FAB ── */}
      {cartCount > 0 && (
        <Button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 xl:left-auto xl:right-8 xl:translate-x-0 h-auto gap-3 rounded-full px-5 py-3.5 shadow-2xl animate-in slide-in-from-bottom-4"
        >
          <div className="relative">
            <ShoppingCart className="size-5" />
            {hasUnavailable && (
              <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-primary" />
            )}
          </div>
          <span className="text-sm font-semibold">
            {cartCount} {cartCount === 1 ? 'item' : 'items'}
          </span>
          <Separator orientation="vertical" className="data-[orientation=vertical]:h-4 bg-primary-foreground/30" />
          <span className="text-sm font-bold">{fmt(hasUnavailable ? validCartTotal : cartTotal)}</span>
        </Button>
      )}

      {/* ── Product Detail Dialog ── */}
      <ProductDetailDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}
        inCart={selectedProduct ? getCartItem(selectedProduct._id) : undefined}
        onAddToCart={addToCartWithQty}
        isCooldown={selectedProduct ? addToCartCooldowns.has(selectedProduct._id) : false}
        rating={selectedProduct ? productRatings.get(selectedProduct._id) : undefined}
        reviews={selectedProduct ? (productReviews.get(selectedProduct._id) ?? []) : undefined}
      />

      {/* ── Cart Dialog ── */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ShoppingCart className="size-4" />
                  Reservation Cart
                  {cartCount > 0 && (
                    <Badge variant="secondary" className="rounded-full text-xs">
                      {cartCount} item{cartCount > 1 ? 's' : ''}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-xs">
                  Payment is made when you claim at the store.
                </DialogDescription>
              </div>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={clearAllCart}
                >
                  <Trash2 data-icon="inline-start" />
                  Clear
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex flex-col max-h-[65vh] overflow-hidden">
            {/* Unavailable banner */}
            {hasUnavailable && (
              <Alert variant="destructive" className="mx-4 mt-4 w-auto">
                <AlertTriangle />
                <AlertTitle className="line-clamp-none">
                  {unavailableItems.length === 1
                    ? `"${unavailableItems[0].product.name}" is no longer available`
                    : `${unavailableItems.length} items are no longer available`}
                </AlertTitle>
                <AlertDescription>
                  <p>These were reserved by other customers. Remove them to continue.</p>
                  <Button variant="destructive" size="xs" className="mt-2 w-full rounded-lg h-7" onClick={removeUnavailableFromCart}>
                    <Trash2 data-icon="inline-start" />
                    Remove {unavailableItems.length} unavailable item{unavailableItems.length > 1 ? 's' : ''}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Cart items */}
            {cart.length === 0 ? (
              <Empty className="border-0 py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShoppingCart />
                  </EmptyMedia>
                  <EmptyDescription>Your cart is empty.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="overflow-y-auto flex-1 px-4 py-3 flex flex-col gap-2">
                {cart.map((item) => {
                  const itemOOS = item.product.stockQuantity === 0;
                  const overQuantity = item.quantity > item.product.stockQuantity && item.product.stockQuantity > 0;
                  const effectivePrice = getEffectivePrice(item.product);
                  const discountPercent = getDiscountPercent(item.product);
                  return (
                    <div
                      key={item.product._id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        itemOOS ? 'border-error/30 bg-error-soft' : overQuantity ? 'border-warning/30 bg-warning-soft' : 'border-border bg-card'
                      }`}
                    >
                      <div className="size-12 shrink-0 rounded-lg overflow-hidden border border-border/40 relative">
                        {item.product.images?.[0] ? (
                          <img src={item.product.images[0]} alt="" className={`h-full w-full object-cover ${itemOOS ? 'grayscale' : ''}`} />
                        ) : (
                          <ImagePlaceholder className="h-full w-full" iconSize="size-4" />
                        )}
                        {itemOOS && (
                          <div className="absolute inset-0 bg-error/20 flex items-center justify-center">
                            <X className="size-4 text-error" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${itemOOS ? 'line-through text-muted-foreground' : ''}`}>
                          {item.product.name}
                        </p>
                        {itemOOS ? (
                          <p className="text-xs font-medium text-error">All reserved — please remove</p>
                        ) : overQuantity ? (
                          <p className="text-xs font-medium text-warning">Only {item.product.stockQuantity} left</p>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {fmt(effectivePrice)} × {item.quantity} = <span className="font-medium text-foreground">{fmt(effectivePrice * item.quantity)}</span>
                            {discountPercent > 0 && (
                              <span className="ml-1.5 text-success font-medium">({discountPercent}% off)</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        {!itemOOS && (
                          <>
                            <Button size="icon-xs" variant="ghost" className="size-7" onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)} disabled={item.quantity <= 1}>
                              <Minus />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{Math.min(item.quantity, item.product.stockQuantity)}</span>
                            <Button size="icon-xs" variant="ghost" className="size-7" onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)} disabled={item.quantity >= item.product.stockQuantity}>
                              <Plus />
                            </Button>
                          </>
                        )}
                        <Button size="icon-xs" variant="ghost" className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeFromCart(item.product._id)}>
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {cart.length > 0 && (
              <>
                <Separator />
                <div className="flex flex-col gap-3 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">Order Total</span>
                    <span className="text-xl font-bold">{fmt(hasUnavailable ? validCartTotal : cartTotal)}</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="reservation-notes">
                      Notes for your reservation (optional)
                    </Label>
                    <Textarea
                      id="reservation-notes"
                      className="min-h-15 resize-none rounded-xl"
                      placeholder="e.g. Preferred pickup time, special requests..."
                      value={reservationNotes}
                      onChange={(e) => setReservationNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl flex-1" onClick={() => setCartOpen(false)}>
                      Continue Shopping
                    </Button>
                    <Button
                      className="rounded-xl flex-1"
                      onClick={handleCheckout}
                      disabled={checkoutLoading || hasUnavailable}
                    >
                      {checkoutLoading ? (
                        <><Spinner data-icon="inline-start" />Placing...</>
                      ) : hasUnavailable ? (
                        'Remove unavailable items first'
                      ) : (
                        `Reserve (${fmt(cartTotal)})`
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Ask / Suggest Dialog ── */}
      <Dialog open={interactionOpen} onOpenChange={(v) => { if (!v) { setInteractionOpen(false); setInteractionContent(''); setInteractionDone(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ask a Question or Suggest a Product</DialogTitle>
            <DialogDescription>Your message will be reviewed by the store team.</DialogDescription>
          </DialogHeader>

          {interactionDone ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-success-soft">
                <CheckCircle2 className="size-7 text-success" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-base font-semibold">Message sent!</p>
                <p className="text-sm text-muted-foreground">The store team will review your message.</p>
              </div>
              <Button className="rounded-full px-6" onClick={() => { setInteractionOpen(false); setInteractionContent(''); setInteractionDone(false); }}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 py-1">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInteractionType('question')}
                    className={`h-auto rounded-xl py-3 ${interactionType === 'question' ? 'border-primary bg-primary-subtle/50 font-semibold text-foreground' : 'text-muted-foreground'}`}
                  >
                    <HelpCircle data-icon="inline-start" />
                    Question
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setInteractionType('recommendation')}
                    className={`h-auto rounded-xl py-3 ${interactionType === 'recommendation' ? 'border-primary bg-primary-subtle/50 font-semibold text-foreground' : 'text-muted-foreground'}`}
                  >
                    <Lightbulb data-icon="inline-start" />
                    Suggestion
                  </Button>
                </div>
                <Textarea
                  value={interactionContent}
                  onChange={(e) => setInteractionContent(e.target.value)}
                  placeholder={interactionType === 'question' ? 'Ask about a product, availability, or anything else...' : "Suggest a product you'd like to see in this store..."}
                  maxLength={1000}
                  rows={4}
                  className="resize-none rounded-xl"
                />
                <p className="text-right text-xs text-muted-foreground">{interactionContent.length}/1000</p>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-full" onClick={() => { setInteractionOpen(false); setInteractionContent(''); }}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full"
                  disabled={interactionSubmitting || !interactionContent.trim()}
                  onClick={async () => {
                    if (!interactionContent.trim()) return;
                    setInteractionSubmitting(true);
                    try {
                      const res = await fetch('/api/interactions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ storeId, type: interactionType, content: interactionContent.trim() }),
                      });
                      if (!res.ok) {
                        const data = await res.json() as { message?: string };
                        toast.error(data.message ?? 'Failed to send message');
                      } else {
                        setInteractionDone(true);
                        setInteractionContent('');
                      }
                    } catch {
                      toast.error('Failed to send message');
                    } finally {
                      setInteractionSubmitting(false);
                    }
                  }}
                >
                  {interactionSubmitting && <Spinner data-icon="inline-start" />}
                  Send Message
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Rate Store Dialog ── */}
      <Dialog open={storeRatingOpen} onOpenChange={(v) => { if (!v) { setStoreRatingOpen(false); setStoreRatingComment(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rate {storeName}</DialogTitle>
            <DialogDescription>
              {hasRatedStore ? 'Update your rating below.' : 'Share your experience with this store.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5 py-1">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStoreRatingStars(s)}
                    className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Star className={`size-9 transition-colors ${s <= storeRatingStars ? 'fill-rating text-rating' : 'text-muted-foreground/20 hover:text-muted-foreground/40'}`} />
                  </button>
                ))}
              </div>
              <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                {['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'][storeRatingStars]}
              </Badge>
            </div>
            <Textarea
              value={storeRatingComment}
              onChange={(e) => setStoreRatingComment(e.target.value)}
              placeholder="Share what you liked or what could be better... (optional)"
              maxLength={500}
              rows={3}
              className="resize-none rounded-xl"
            />
            <p className="text-right text-xs text-muted-foreground">{storeRatingComment.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => { setStoreRatingOpen(false); setStoreRatingComment(''); }} disabled={storeRatingSubmitting}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              disabled={storeRatingSubmitting}
              onClick={async () => {
                setStoreRatingSubmitting(true);
                try {
                  const res = await fetch('/api/ratings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      storeId,
                      ratings: [{ type: 'store', stars: storeRatingStars, comment: storeRatingComment.trim() || undefined }],
                    }),
                  });
                  if (!res.ok) {
                    const d = await res.json() as { message?: string };
                    toast.error(d.message ?? 'Failed to submit rating');
                    return;
                  }
                  setHasRatedStore(true);
                  setExistingStoreStars(storeRatingStars);
                  setStoreRatingOpen(false);
                  setStoreRatingComment('');
                  toast.success('Thank you for your rating!');
                } catch {
                  toast.error('Failed to submit rating');
                } finally {
                  setStoreRatingSubmitting(false);
                }
              }}
            >
              {storeRatingSubmitting && <Spinner data-icon="inline-start" />}
              {hasRatedStore ? 'Update Rating' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Success Dialog ── */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-success-soft">
              <CheckCircle2 className="size-8 text-success" />
            </div>
            <DialogHeader className="items-center gap-1.5 text-center sm:text-center">
              <DialogTitle className="text-xl font-bold leading-normal">Reservation Confirmed!</DialogTitle>
              <DialogDescription>
                Your items have been reserved. Head to the store to claim and pay at your convenience.
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="flex-col sm:flex-col gap-2">
            <Button className="w-full rounded-xl" onClick={() => setSuccessOpen(false)}>
              Continue Shopping
            </Button>
            <Button variant="outline" className="w-full rounded-xl" asChild>
              <a href="/purchases">View My Reservations</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Payment Options Dialog ── */}
      <Dialog open={paymentOptionsOpen} onOpenChange={setPaymentOptionsOpen}>
        <DialogContent className="w-[min(96vw,52rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-5" />
              Payment Options
            </DialogTitle>
            <DialogDescription>
              Scan a QR code or use the account details below to pay for your reservation.
            </DialogDescription>
          </DialogHeader>

          {paymentOptionsLoading ? (
            <div className="flex flex-col gap-3 py-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={i} className="py-4 gap-0">
                  <CardContent className="flex gap-4 px-4">
                    <Skeleton className="size-48 rounded-xl shrink-0" />
                    <div className="flex flex-1 flex-col gap-3 pt-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : paymentOptions.length === 0 ? (
            <Empty className="border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <QrCode />
                </EmptyMedia>
                <EmptyDescription>No payment options available for this store yet.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-4">
              {paymentOptions.length > 1 ? (
                <Tabs
                  defaultValue={paymentOptions[0]._id}
                  onValueChange={(id) => setSelectedPaymentOption(paymentOptions.find((o) => o._id === id) ?? null)}
                >
                  <TabsList className="w-full">
                    {paymentOptions.map((opt) => (
                      <TabsTrigger key={opt._id} value={opt._id} className="flex-1 gap-1.5">
                        {opt.type === 'e-wallet' ? <Wallet /> : <CreditCard />}
                        {opt.label || opt.recipientName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {paymentOptions.map((opt) => (
                    <TabsContent key={opt._id} value={opt._id}>
                      <PaymentOptionDetail option={opt} />
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <PaymentOptionDetail option={paymentOptions[0]} />
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setPaymentOptionsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment option detail sub-component
// ---------------------------------------------------------------------------

function PaymentOptionDetail({ option }: { option: PaymentOption }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <PaymentQrImage url={option.qrImageUrl} label={option.label || option.recipientName} />
      </div>
      <Card className="py-4 gap-0">
        <CardContent className="flex flex-col gap-3 px-4">
          <div className="flex items-center gap-2">
            {option.type === 'e-wallet' ? <Wallet className="size-4 text-muted-foreground" /> : <CreditCard className="size-4 text-muted-foreground" />}
            <span className="text-xs font-medium text-muted-foreground capitalize">{option.type}</span>
            {option.label && <span className="ml-auto text-xs font-semibold">{option.label}</span>}
          </div>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Recipient</p>
              <p className="text-sm font-bold">{option.recipientName}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={() => {
                navigator.clipboard.writeText(option.recipientName);
                toast.success('Copied to clipboard!');
              }}
            >
              Copy
            </Button>
          </div>
          {option.accountDetails && (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Account Details</p>
                <p className="text-sm font-medium mt-0.5">{option.accountDetails}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentQrImage({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex size-[min(78vw,22rem)] items-center justify-center rounded-2xl border border-dashed border-border bg-muted">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageIcon className="size-10 text-muted-foreground/40" />
          <p className="text-xs">Image unavailable</p>
        </div>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      className="size-[min(78vw,22rem)] rounded-2xl border border-border object-contain bg-white shadow-sm"
      onError={() => setFailed(true)}
    />
  );
}

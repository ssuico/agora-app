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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, CreditCard, Eye,
  Grid3x3, HelpCircle, ImageIcon, LayoutGrid, Lightbulb, Loader2, MessageSquare,
  Minus, Package, Plus, QrCode, Search, ShoppingCart, Star, Store, Trash2, Wallet, X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';
import { ActivityFeed } from './ActivityFeed';
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

function ImagePlaceholder({ className, iconSize = 'h-8 w-8' }: { className?: string; iconSize?: string }) {
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
          <button onClick={prev} className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded-full p-1">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={next} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded-full p-1">
            <ChevronRight className="h-4 w-4" />
          </button>
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
  const btnSize = size === 'md' ? 'h-8 w-8' : 'h-6 w-6';
  const iconSize = size === 'md' ? 'h-4 w-4' : 'h-3 w-3';
  const textSize = size === 'md' ? 'text-lg w-10' : 'text-sm w-8';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} className={`${btnSize} inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none`}>
        <Minus className={iconSize} />
      </button>
      <span className={`${textSize} text-center font-medium`}>{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className={`${btnSize} inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none`}>
        <Plus className={iconSize} />
      </button>
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
            className={`h-3 w-3 ${s <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
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
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0 gap-0">
        <div className="grid max-h-[92vh] grid-cols-1 md:grid-cols-[1.1fr_1fr] overflow-hidden">

          {/* Left: Image panel */}
          <div className="flex flex-col border-b md:border-b-0 md:border-r bg-muted/20">
            <div className="relative aspect-square bg-muted/30 overflow-hidden">
              {!hasImages || failedSet.has(selectedIndex) ? (
                <ImagePlaceholder className="h-full w-full" iconSize="h-16 w-16" />
              ) : (
                <SafeImage
                  src={images[selectedIndex]}
                  alt={product.name}
                  className="h-full w-full"
                  onError={() => setFailedSet((prev) => new Set(prev).add(selectedIndex))}
                />
              )}

              {discountPercent > 0 && (
                <Badge className="absolute left-3 top-3 bg-green-500 border-0 text-white text-xs font-bold shadow-sm">
                  -{discountPercent}%
                </Badge>
              )}

              {isOOS && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
                  <Badge variant="destructive" className="px-4 py-1.5 text-sm font-semibold">
                    All Reserved
                  </Badge>
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedIndex((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedIndex((i) => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition-colors"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3 bg-card/50">
                {images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${i === selectedIndex ? 'border-primary shadow-sm' : 'border-transparent opacity-60 hover:opacity-100 hover:border-muted-foreground/30'}`}
                  >
                    {failedSet.has(i) ? (
                      <ImagePlaceholder className="h-full w-full" iconSize="h-4 w-4" />
                    ) : (
                      <SafeImage
                        src={url}
                        alt=""
                        className="h-full w-full"
                        onError={() => setFailedSet((prev) => new Set(prev).add(i))}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Details panel */}
          <div className="relative flex min-h-0 flex-col overflow-y-auto">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 z-10 rounded-full p-1.5 transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col gap-4 p-5 sm:p-6">
              {/* Name + price */}
              <div className="pr-8">
                <h2 className="text-xl font-bold leading-snug">{product.name}</h2>

                <div className="mt-3 flex items-end gap-3">
                  <p className="text-3xl font-bold text-primary">{fmt(effectivePrice)}</p>
                  {discountPercent > 0 && (
                    <div className="mb-1 flex flex-col">
                      <span className="text-sm text-muted-foreground line-through">{fmt(product.sellingPrice)}</span>
                      <span className="text-xs font-semibold text-green-600">{discountPercent}% off</span>
                    </div>
                  )}
                </div>

                {/* Stock + rating row */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={`text-xs font-medium ${
                      isOOS
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : product.stockQuantity < 10
                          ? 'bg-amber-100 text-amber-700 border-amber-200'
                          : 'bg-green-100 text-green-700 border-green-200'
                    }`}
                  >
                    <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${isOOS ? 'bg-red-500' : product.stockQuantity < 10 ? 'bg-amber-500' : 'bg-green-500'}`} />
                    {isOOS ? 'All Reserved' : `${product.stockQuantity} in stock`}
                  </Badge>
                  {cartQty > 0 && (
                    <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/5">
                      {cartQty} in cart
                    </Badge>
                  )}
                </div>

                {rating && rating.totalCount > 0 && (
                  <div className="mt-2.5">
                    <MiniStars value={rating.averageStars} count={rating.totalCount} />
                  </div>
                )}

                <a
                  href={`/products/${product._id}/rate`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Star className="h-3.5 w-3.5" />
                  Rate this product
                </a>
              </div>

              <Separator />

              {/* Add to cart section */}
              <div className="rounded-xl border bg-muted/20 p-4">
                {isOOS ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center space-y-1">
                    <p className="text-sm font-semibold text-red-700">Fully reserved</p>
                    <p className="text-xs text-red-600">Check back later for availability.</p>
                  </div>
                ) : available > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-muted-foreground">Quantity</span>
                      <QuantityPicker value={qty} max={available} onChange={setQty} size="md" />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-bold text-foreground">{fmt(effectivePrice * qty)}</span>
                    </div>
                    <Button
                      className="w-full rounded-xl"
                      size="lg"
                      onClick={() => {
                        onAddToCart(product, qty);
                        setQty(1);
                      }}
                      disabled={isCooldown}
                    >
                      {isCooldown ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Added!</>
                      ) : (
                        <><ShoppingCart className="mr-2 h-4 w-4" />Add {qty > 1 ? `${qty} × ` : ''}to Cart</>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="py-2 text-center text-sm text-muted-foreground">All available stock is already in your cart.</p>
                )}
              </div>

              {/* Reviews */}
              <div className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    Customer Reviews
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {reviewCount} review{reviewCount === 1 ? '' : 's'}
                  </span>
                </div>

                {sortedReviews.length > 0 ? (
                  <ul className="max-h-56 overflow-y-auto divide-y divide-border">
                    {sortedReviews.map((r) => (
                      <li key={r._id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3 w-3 ${s <= r.stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20'}`}
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
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">No reviews yet for this product.</p>
                )}
              </div>
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

export function ShopView({ storeId, storeName, initialIsOpen = true, initialIsMaintenance = false }: ShopViewProps) {
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

    toast.success(`Added ${qty} × "${product.name}" to cart`, {
      style: { background: '#84B179', color: '#fff' },
      iconTheme: { primary: '#fff', secondary: '#84B179' },
    });

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
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Under Maintenance</h1>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{storeName}</span> is temporarily unavailable.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-amber-700">
              <Clock className="h-4 w-4" />
              Maintenance in progress
            </div>
            <p className="text-sm text-amber-600">We apologize for the inconvenience. Please check back soon.</p>
          </div>
          <Button asChild variant="outline" className="rounded-full px-6">
            <a href="/purchases"><Package className="mr-2 h-4 w-4" />My Purchases</a>
          </Button>
        </div>
      </div>
    );
  }

  if (!isStoreOpen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Store className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Store Closed</h1>
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">{storeName}</span> is not accepting reservations right now.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              The store manager has closed this store for the day.
            </div>
            <p className="text-sm text-muted-foreground">Please check back tomorrow.</p>
          </div>
          <Button asChild variant="outline" className="rounded-full px-6">
            <a href="/purchases"><Package className="mr-2 h-4 w-4" />My Purchases</a>
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-72" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 flex-1 max-w-sm rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card overflow-hidden">
              {/* Image — matches h-44 */}
              <Skeleton className="h-44 w-full rounded-none" />
              <div className="p-3 space-y-2">
                {/* Product name */}
                <Skeleton className="h-4 w-3/4" />
                {/* Stars row */}
                <Skeleton className="h-3 w-1/3" />
                {/* Price + stock badge */}
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-14 rounded-full" />
                </div>
                {/* Qty row */}
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-6" />
                  <Skeleton className="h-7 w-24 rounded-lg" />
                </div>
                {/* Add to Cart button */}
                <Skeleton className="h-8 w-full rounded-xl" />
                {/* Rate button */}
                <Skeleton className="h-7 w-full rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Main render ---

  return (
    <div className="space-y-5">

      {/* Stock alerts */}
      {stockAlerts.map((alert) => (
        <div key={alert.id} className="animate-in slide-in-from-top-2 flex items-start gap-3 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-orange-800">Stock updated by another reservation</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {alert.names.length === 1
                ? `"${alert.names[0]}" has limited or no stock remaining.`
                : `${alert.names.length} items have limited stock: ${alert.names.map((n) => `"${n}"`).join(', ')}.`}
              {' '}Please review your cart.
            </p>
          </div>
          <button onClick={() => dismissAlert(alert.id)} className="shrink-0 rounded p-0.5 hover:bg-orange-100 transition-colors">
            <X className="h-4 w-4 text-orange-600" />
          </button>
        </div>
      ))}

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{storeName}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Open
            </span>
          </div>
          <p className="text-sm text-muted-foreground">Browse and reserve items — pay when you claim</p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" asChild className="rounded-full h-8 text-xs gap-1.5">
            <a href="/purchases">
              <Package className="h-3.5 w-3.5" />
              My Purchases
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={openPaymentOptions} className="rounded-full h-8 text-xs gap-1.5">
            <QrCode className="h-3.5 w-3.5" />
            Scan to Pay
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setInteractionOpen(true); setInteractionDone(false); }}
            className="rounded-full h-8 text-xs gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ask / Suggest
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStoreRatingOpen(true)}
            className={`rounded-full h-8 text-xs gap-1.5 ${hasRatedStore ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' : ''}`}
          >
            <Star className={`h-3.5 w-3.5 ${hasRatedStore ? 'fill-amber-400 text-amber-400' : ''}`} />
            {hasRatedStore ? `${existingStoreStars}★ Rated` : 'Rate Store'}
          </Button>
          {/* Desktop cart button — hidden when FAB is visible */}
          <Button
            variant={cartCount > 0 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCartOpen(true)}
            className="relative rounded-full h-8 text-xs gap-1.5"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Cart
            {cartCount > 0 && (
              <Badge className={`ml-0.5 h-4 min-w-[16px] rounded-full px-1 py-0 text-[10px] leading-none flex items-center justify-center border-0 ${hasUnavailable ? 'bg-destructive text-destructive-foreground' : 'bg-primary-foreground text-primary'}`}>
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

          <div className="space-y-4">
          {/* Search + grid controls */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-border/60 bg-card/50 focus-visible:ring-primary/30"
              />
            </div>

            <div className="flex items-center rounded-xl border border-border/60 bg-card/50 p-1 gap-0.5 shrink-0">
              {([
                { cols: 3 as const, icon: <LayoutGrid className="h-4 w-4" /> },
                { cols: 6 as const, icon: <Grid3x3 className="h-4 w-4" /> },
                { cols: 9 as const, icon: <Grid3x3 className="h-3.5 w-3.5" /> },
              ]).map(({ cols, icon }) => (
                <button
                  key={cols}
                  onClick={() => setGridCols(cols)}
                  title={`${cols} columns`}
                  aria-label={`${cols} columns`}
                  className={`flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    gridCols === cols
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {icon}
                </button>
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
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              {searchQuery ? (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Search className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium text-foreground">No results for &ldquo;{searchQuery}&rdquo;</p>
                    <p className="text-sm text-muted-foreground">Try a different search term.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery('')} className="rounded-full">
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium text-foreground">No products available</p>
                    <p className="text-sm text-muted-foreground">This store hasn't listed any products yet.</p>
                  </div>
                </>
              )}
            </div>
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
                    className={`group overflow-hidden p-0 gap-0 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isOOS ? 'opacity-60' : ''}`}
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
                        <Badge className="absolute left-2 top-2 bg-green-500 border-0 text-white text-[10px] font-bold shadow-sm px-1.5 py-0.5">
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
                            <Eye className={`${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                            {isCompact ? 'Reviews' : 'View reviews'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card body */}
                    <CardContent className={`flex flex-col ${isMini ? 'p-1.5 gap-1' : isCompact ? 'p-2.5 gap-2' : 'p-3 gap-2'}`}>
                      {/* Name */}
                      <button className="text-left" onClick={() => setSelectedProduct(product)}>
                        <h3 className={`font-semibold transition-colors ${isOOS ? 'text-muted-foreground' : 'group-hover:text-primary'} ${isMini ? 'text-[10px] line-clamp-1' : isCompact ? 'text-xs line-clamp-1' : 'text-sm line-clamp-2 leading-snug'}`}>
                          {product.name}
                        </h3>
                      </button>

                      {/* Stars (normal + compact) */}
                      {!isMini && rating && rating.totalCount > 0 && (
                        <MiniStars value={rating.averageStars} count={rating.totalCount} />
                      )}

                      {/* Price + stock row */}
                      <div className={`flex items-end justify-between gap-1 ${isMini ? '' : ''}`}>
                        <div>
                          <p className={`font-bold ${isOOS ? 'text-muted-foreground' : 'text-primary'} ${isMini ? 'text-[10px]' : isCompact ? 'text-sm' : 'text-xl'}`}>
                            {fmt(effectivePrice)}
                          </p>
                          {!isMini && discountPercent > 0 && (
                            <p className="text-xs text-muted-foreground line-through">{fmt(product.sellingPrice)}</p>
                          )}
                        </div>

                        {!isMini && !isCompact && (
                          <Badge
                            variant="secondary"
                            className={`shrink-0 text-[10px] font-medium px-1.5 py-0 h-5 ${
                              isOOS
                                ? 'bg-red-100 text-red-700'
                                : product.stockQuantity < 10
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                            }`}
                          >
                            {isOOS ? 'Reserved' : `${product.stockQuantity} left`}
                          </Badge>
                        )}
                      </div>

                      {/* In-cart note */}
                      {!isCompact && !isMini && inCart && (
                        <p className={`text-xs font-medium ${isOOS ? 'text-red-600' : 'text-primary/80'}`}>
                          {inCart.quantity} in cart{isOOS ? ' (unavailable)' : ''}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="space-y-1.5">
                        {isMini ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => setSelectedProduct(product)}
                              className={`flex-1 flex items-center justify-center rounded-lg py-1 transition-colors ${
                                isOOS || available === 0
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
                              }`}
                            >
                              <ShoppingCart className="h-3 w-3" />
                            </button>
                            <a
                              href={`/products/${product._id}/rate`}
                              className={`flex items-center justify-center rounded-lg px-1.5 py-1 border transition-colors ${
                                hasRated
                                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                                  : 'border-border text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <Star className={`h-3 w-3 ${hasRated ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </a>
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
                                  className="w-full rounded-lg h-7 text-xs"
                                  size="sm"
                                  onClick={() => addToCartWithQty(product, Math.min(cardQty, available))}
                                  disabled={addToCartCooldowns.has(product._id)}
                                >
                                  {addToCartCooldowns.has(product._id)
                                    ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Added!</>
                                    : <><ShoppingCart className="mr-1 h-3 w-3" />Add</>
                                  }
                                </Button>
                              </>
                            ) : (
                              <p className="text-center text-[10px] text-muted-foreground py-0.5">In cart</p>
                            )}
                            <a
                              href={`/products/${product._id}/rate`}
                              className={`flex w-full items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${
                                hasRated
                                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <Star className={`h-2.5 w-2.5 ${hasRated ? 'fill-amber-400 text-amber-400' : ''}`} />
                              Rate
                            </a>
                          </>
                        ) : (
                          /* Normal (3-col) */
                          <>
                            {isOOS ? (
                              inCart ? (
                                <div className="rounded-lg bg-red-50 border border-red-200 px-2 py-2 text-center">
                                  <p className="text-xs font-medium text-red-700">No longer available</p>
                                </div>
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
                                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Added!</>
                                  ) : (
                                    <><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Add to Cart</>
                                  )}
                                </Button>
                              </>
                            ) : (
                              <p className="py-1 text-center text-xs text-muted-foreground">All stock in cart</p>
                            )}
                            <a
                              href={`/products/${product._id}/rate`}
                              className={`flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                                hasRated
                                  ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                              }`}
                            >
                              <Star className={`h-3 w-3 ${hasRated ? 'fill-amber-400 text-amber-400' : ''}`} />
                              {hasRated ? 'View My Rating' : 'Rate Product'}
                            </a>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          </div>{/* end space-y-4 */}
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
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 xl:left-auto xl:right-8 xl:translate-x-0 flex items-center gap-3 rounded-full bg-primary px-5 py-3.5 text-primary-foreground shadow-2xl hover:bg-primary/90 hover:shadow-3xl transition-all duration-200 animate-in slide-in-from-bottom-4"
        >
          <div className="relative">
            <ShoppingCart className="h-5 w-5" />
            {hasUnavailable && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-400 ring-2 ring-primary" />
            )}
          </div>
          <span className="text-sm font-semibold">
            {cartCount} {cartCount === 1 ? 'item' : 'items'}
          </span>
          <span className="h-4 w-px bg-primary-foreground/30" />
          <span className="text-sm font-bold">{fmt(hasUnavailable ? validCartTotal : cartTotal)}</span>
        </button>
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
                  <ShoppingCart className="h-4 w-4" />
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
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                  onClick={clearAllCart}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex flex-col max-h-[65vh] overflow-hidden">
            {/* Unavailable banner */}
            {hasUnavailable && (
              <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-800">
                      {unavailableItems.length === 1
                        ? `"${unavailableItems[0].product.name}" is no longer available`
                        : `${unavailableItems.length} items are no longer available`}
                    </p>
                    <p className="text-xs text-red-700 mt-0.5">
                      These were reserved by other customers. Remove them to continue.
                    </p>
                  </div>
                </div>
                <Button variant="destructive" size="sm" className="w-full rounded-lg h-7 text-xs" onClick={removeUnavailableFromCart}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Remove {unavailableItems.length} unavailable item{unavailableItems.length > 1 ? 's' : ''}
                </Button>
              </div>
            )}

            {/* Cart items */}
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <ShoppingCart className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground">Your cart is empty.</p>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
                {cart.map((item) => {
                  const itemOOS = item.product.stockQuantity === 0;
                  const overQuantity = item.quantity > item.product.stockQuantity && item.product.stockQuantity > 0;
                  const effectivePrice = getEffectivePrice(item.product);
                  const discountPercent = getDiscountPercent(item.product);
                  return (
                    <div
                      key={item.product._id}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        itemOOS ? 'border-red-200 bg-red-50' : overQuantity ? 'border-amber-200 bg-amber-50' : 'border-border/60 bg-card/50'
                      }`}
                    >
                      <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden border border-border/40 relative">
                        {item.product.images?.[0] ? (
                          <img src={item.product.images[0]} alt="" className={`h-full w-full object-cover ${itemOOS ? 'grayscale' : ''}`} />
                        ) : (
                          <ImagePlaceholder className="h-full w-full" iconSize="h-4 w-4" />
                        )}
                        {itemOOS && (
                          <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                            <X className="h-4 w-4 text-red-600" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${itemOOS ? 'line-through text-muted-foreground' : ''}`}>
                          {item.product.name}
                        </p>
                        {itemOOS ? (
                          <p className="text-xs font-medium text-red-600">All reserved — please remove</p>
                        ) : overQuantity ? (
                          <p className="text-xs font-medium text-amber-600">Only {item.product.stockQuantity} left</p>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {fmt(effectivePrice)} × {item.quantity} = <span className="font-medium text-foreground">{fmt(effectivePrice * item.quantity)}</span>
                            {discountPercent > 0 && (
                              <span className="ml-1.5 text-green-600 font-medium">({discountPercent}% off)</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5">
                        {!itemOOS && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)} disabled={item.quantity <= 1}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{Math.min(item.quantity, item.product.stockQuantity)}</span>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)} disabled={item.quantity >= item.product.stockQuantity}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => removeFromCart(item.product._id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {cart.length > 0 && (
              <div className="border-t px-4 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">Order Total</span>
                  <span className="text-xl font-bold">{fmt(hasUnavailable ? validCartTotal : cartTotal)}</span>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reservation-notes" className="text-xs font-medium text-muted-foreground">
                    Notes for your reservation (optional)
                  </label>
                  <textarea
                    id="reservation-notes"
                    className="flex min-h-[60px] w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 transition-all"
                    placeholder="e.g. Preferred pickup time, special requests..."
                    value={reservationNotes}
                    onChange={(e) => setReservationNotes(e.target.value)}
                    rows={2}
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
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
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Placing...</>
                    ) : hasUnavailable ? (
                      'Remove unavailable items first'
                    ) : (
                      `Reserve (${fmt(cartTotal)})`
                    )}
                  </Button>
                </div>
              </div>
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
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold">Message sent!</p>
                <p className="text-sm text-muted-foreground">The store team will review your message.</p>
              </div>
              <Button className="rounded-full px-6" onClick={() => { setInteractionOpen(false); setInteractionContent(''); setInteractionDone(false); }}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInteractionType('question')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${interactionType === 'question' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted hover:border-border/80'}`}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setInteractionType('recommendation')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${interactionType === 'recommendation' ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted hover:border-border/80'}`}
                  >
                    <Lightbulb className="h-4 w-4" />
                    Suggestion
                  </button>
                </div>
                <textarea
                  value={interactionContent}
                  onChange={(e) => setInteractionContent(e.target.value)}
                  placeholder={interactionType === 'question' ? 'Ask about a product, availability, or anything else...' : "Suggest a product you'd like to see in this store..."}
                  maxLength={1000}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
                <p className="text-right text-xs text-muted-foreground">{interactionContent.length}/1000</p>
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-full" onClick={() => { setInteractionOpen(false); setInteractionContent(''); }}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full gap-2"
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
                  {interactionSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
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
          <div className="space-y-5 py-1">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStoreRatingStars(s)}
                    className="rounded-lg p-1 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Star className={`h-9 w-9 transition-colors ${s <= storeRatingStars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/20 hover:text-muted-foreground/40'}`} />
                  </button>
                ))}
              </div>
              <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                {['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'][storeRatingStars]}
              </Badge>
            </div>
            <textarea
              value={storeRatingComment}
              onChange={(e) => setStoreRatingComment(e.target.value)}
              placeholder="Share what you liked or what could be better... (optional)"
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-xl border border-input bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
            />
            <p className="text-right text-xs text-muted-foreground">{storeRatingComment.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => { setStoreRatingOpen(false); setStoreRatingComment(''); }} disabled={storeRatingSubmitting}>
              Cancel
            </Button>
            <Button
              className="rounded-full gap-2"
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
              {storeRatingSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {hasRatedStore ? 'Update Rating' : 'Submit Rating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Success Dialog ── */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold">Reservation Confirmed!</h2>
              <p className="text-sm text-muted-foreground">
                Your items have been reserved. Head to the store to claim and pay at your convenience.
              </p>
            </div>
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
              <QrCode className="h-5 w-5" />
              Payment Options
            </DialogTitle>
            <DialogDescription>
              Scan a QR code or use the account details below to pay for your reservation.
            </DialogDescription>
          </DialogHeader>

          {paymentOptionsLoading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex gap-4 rounded-xl border p-4">
                  <Skeleton className="h-48 w-48 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-3 pt-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : paymentOptions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <QrCode className="h-7 w-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground">No payment options available for this store yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentOptions.length > 1 ? (
                <Tabs
                  defaultValue={paymentOptions[0]._id}
                  onValueChange={(id) => setSelectedPaymentOption(paymentOptions.find((o) => o._id === id) ?? null)}
                >
                  <TabsList className="w-full">
                    {paymentOptions.map((opt) => (
                      <TabsTrigger key={opt._id} value={opt._id} className="flex-1 gap-1.5">
                        {opt.type === 'e-wallet' ? <Wallet className="h-3.5 w-3.5" /> : <CreditCard className="h-3.5 w-3.5" />}
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
    <div className="space-y-4">
      <div className="flex justify-center">
        <PaymentQrImage url={option.qrImageUrl} label={option.label || option.recipientName} />
      </div>
      <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          {option.type === 'e-wallet' ? <Wallet className="h-4 w-4 text-muted-foreground" /> : <CreditCard className="h-4 w-4 text-muted-foreground" />}
          <span className="text-xs font-medium text-muted-foreground capitalize">{option.type}</span>
          {option.label && <span className="ml-auto text-xs font-semibold">{option.label}</span>}
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Recipient</p>
            <p className="text-sm font-bold">{option.recipientName}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(option.recipientName);
              toast.success('Copied to clipboard!');
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            Copy
          </button>
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
      </div>
    </div>
  );
}

function PaymentQrImage({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-[min(78vw,22rem)] w-[min(78vw,22rem)] items-center justify-center rounded-2xl border border-dashed border-border bg-muted">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-xs">Image unavailable</p>
        </div>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={label}
      className="h-[min(78vw,22rem)] w-[min(78vw,22rem)] rounded-2xl border border-border object-contain bg-white shadow-sm"
      onError={() => setFailed(true)}
    />
  );
}

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, CreditCard, Eye, Grid3x3, HelpCircle, ImageIcon, LayoutGrid, Lightbulb, Loader2, MessageSquare, Minus, Package, Plus, QrCode, Search, ShoppingCart, Star, Store, Trash2, Wallet, X } from 'lucide-react';
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
// Product detail dialog
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
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden p-0">
        <div className="grid max-h-[90vh] grid-cols-1 md:grid-cols-[1.02fr_1fr]">
          <div className="flex flex-col border-b md:border-b-0 md:border-r">
            <div className="relative aspect-square bg-muted/30">
              {!hasImages || failedSet.has(selectedIndex) ? (
                <ImagePlaceholder className="h-full w-full" iconSize="h-12 w-12" />
              ) : (
                <SafeImage
                  src={images[selectedIndex]}
                  alt={product.name}
                  className="h-full w-full"
                  onError={() => setFailedSet((prev) => new Set(prev).add(selectedIndex))}
                />
              )}
              {isOOS && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">All Reserved</span>
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedIndex((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedIndex((i) => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${i === selectedIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'}`}
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

          <div className="relative flex min-h-0 flex-col p-5 sm:p-6">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 rounded-full p-1 transition-colors hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <h2 className="text-xl font-bold">{product.name}</h2>
              <div className="mt-2">
                <p className="text-2xl font-bold text-primary">{fmt(effectivePrice)}</p>
                {discountPercent > 0 && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">{fmt(product.sellingPrice)}</span>
                    <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      {discountPercent}% OFF
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isOOS
                      ? 'bg-red-100 text-red-700'
                      : product.stockQuantity < 10
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {isOOS ? 'All Reserved' : `${product.stockQuantity} in stock`}
                </span>
                {cartQty > 0 && <span className="text-xs text-muted-foreground">({cartQty} in cart)</span>}
                {hasImages && images.length > 1 && (
                  <span className="text-xs text-muted-foreground">{images.length} photos available</span>
                )}
              </div>

              {rating && rating.totalCount > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <MiniStars value={rating.averageStars} count={rating.totalCount} />
                  <span className="text-xs text-muted-foreground">{rating.totalCount} total ratings</span>
                </div>
              )}

              <div className="mt-2">
                <a
                  href={`/products/${product._id}/rate`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Star className="h-3.5 w-3.5" />
                  Rate this product
                </a>
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-muted/20 p-4">
              {isOOS ? (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-center">
                  <p className="text-sm font-medium text-red-700">This item has been fully reserved by other customers.</p>
                  <p className="mt-1 text-xs text-red-600">Check back later for availability.</p>
                </div>
              ) : available > 0 ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Quantity</span>
                    <QuantityPicker value={qty} max={available} onChange={setQty} size="md" />
                  </div>
                  <p className="mt-2 text-right text-sm text-muted-foreground">
                    Subtotal: <span className="font-medium text-foreground">{fmt(effectivePrice * qty)}</span>
                  </p>
                  <Button
                    className="mt-3 w-full"
                    onClick={() => {
                      onAddToCart(product, qty);
                      setQty(1);
                    }}
                    disabled={isCooldown}
                  >
                    {isCooldown ? (
                      <>
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        Added to Cart
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="mr-1.5 h-4 w-4" />
                        Add {qty} to Cart
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <p className="py-2 text-center text-sm text-muted-foreground">All available stock is in your cart</p>
              )}
            </div>

            <div className="mt-4 min-h-0 rounded-xl border bg-card">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  Customer Reviews
                </h4>
                <span className="text-xs text-muted-foreground">
                  {reviewCount} review{reviewCount === 1 ? '' : 's'}
                </span>
              </div>

              {sortedReviews.length > 0 ? (
                <ul className="max-h-64 overflow-y-auto px-2 py-2 sm:max-h-72">
                  {sortedReviews.map((r) => (
                    <li key={r._id} className="rounded-lg px-2 py-2.5 hover:bg-muted/40">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-3 w-3 ${s <= r.stars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
                            />
                          ))}
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      {r.comment ? (
                        <p className="break-words text-xs leading-relaxed text-foreground">{r.comment}</p>
                      ) : (
                        <p className="text-xs italic text-muted-foreground">No comment provided.</p>
                      )}

                      <p className="mt-0.5 text-[10px] text-muted-foreground">- {r.customerId?.name ?? 'Anonymous'}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-5 text-center text-xs text-muted-foreground">No written reviews yet for this product.</p>
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

  // Rating aggregates (community-wide) + this user's own rated products
  const [productRatings, setProductRatings] = useState<Map<string, ProductRatingStat>>(new Map());
  const [productReviews, setProductReviews] = useState<Map<string, FeedbackEntry[]>>(new Map());
  const [myRatedProductIds, setMyRatedProductIds] = useState<Set<string>>(new Set());

  // Store rating
  const [storeRatingOpen, setStoreRatingOpen] = useState(false);
  const [storeRatingStars, setStoreRatingStars] = useState(5);
  const [storeRatingComment, setStoreRatingComment] = useState('');
  const [storeRatingSubmitting, setStoreRatingSubmitting] = useState(false);
  const [hasRatedStore, setHasRatedStore] = useState(false);
  const [existingStoreStars, setExistingStoreStars] = useState<number | null>(null);

  // Interaction (Q&A / recommendations)
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionType, setInteractionType] = useState<'question' | 'recommendation'>('question');
  const [interactionContent, setInteractionContent] = useState('');
  const [interactionSubmitting, setInteractionSubmitting] = useState(false);
  const [interactionDone, setInteractionDone] = useState(false);

  // Payment options
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
      if (data.storeId === storeId) {
        setIsStoreOpen(data.isOpen);
      }
    };

    const handleMaintenanceChange = (data: { storeId: string; isMaintenance: boolean }) => {
      if (data.storeId === storeId) {
        setIsMaintenance(data.isMaintenance);
      }
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

      toast.success('Reservation placed');
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

  // --- Render ---

  if (isMaintenance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Maintenance Ongoing</h1>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{storeName}</span> is currently undergoing maintenance and is temporarily unavailable.
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3 flex flex-col items-center">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4 shrink-0" />
              <span>Maintenance mode or maintenance ongoing.</span>
            </div>
            <p className="text-sm text-muted-foreground">
              We apologize for the inconvenience. Please check back soon.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild variant="outline">
              <a href="/purchases">
                <Package className="mr-1.5 h-4 w-4" />
                My Purchases
              </a>
            </Button>
          </div>
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
              <span className="font-medium text-foreground">{storeName}</span> is currently closed and not accepting reservations.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-card/80 p-4 space-y-3 flex flex-col items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>The store manager has closed this store for the day.</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Please check back later or tomorrow.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild variant="outline">
              <a href="/purchases">
                <Package className="mr-1.5 h-4 w-4" />
                My Purchases
              </a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
        </div>
        <Skeleton className="h-10 w-full max-w-sm rounded-xl" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="product-card-surface rounded-xl overflow-hidden flex flex-col">
              <Skeleton className="h-48 w-full rounded-none" />
              <div className="p-4 flex flex-col gap-3">
                <Skeleton className="h-5 w-3/4" />
                <div className="flex items-baseline justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="mt-auto pt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stock alerts */}
      {stockAlerts.map((alert) => (
        <div key={alert.id} className="animate-in slide-in-from-top-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800">Stock updated by another reservation</p>
            <p className="text-xs text-orange-700 mt-0.5">
              {alert.names.length === 1
                ? `"${alert.names[0]}" has limited or no stock remaining.`
                : `${alert.names.length} items in your cart have limited or no stock remaining: ${alert.names.map((n) => `"${n}"`).join(', ')}.`}
              {' '}Please review your cart.
            </p>
          </div>
          <button onClick={() => dismissAlert(alert.id)} className="shrink-0 rounded p-0.5 hover:bg-orange-100"><X className="h-4 w-4 text-orange-600" /></button>
        </div>
      ))}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{storeName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Browse products and add to cart</p>
        </div>
        <div className="flex items-center gap-1.5">
          <a href="/purchases" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors">
            <Package className="h-3.5 w-3.5" />
            My Purchases
          </a>
          <Button
            variant="ghost"
            size="sm"
            onClick={openPaymentOptions}
            className="gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <QrCode className="h-3.5 w-3.5" />
            Scan to Pay
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setInteractionOpen(true); setInteractionDone(false); }}
            className="gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ask / Suggest
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStoreRatingOpen(true)}
            className="gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <Star className={`h-3.5 w-3.5 ${hasRatedStore ? 'fill-amber-400 text-amber-400' : ''}`} />
            {hasRatedStore ? `Rated (${existingStoreStars}★)` : 'Rate Store'}
          </Button>
          <div className="h-6 w-px bg-border/60 mx-1" />
          <Button variant="outline" onClick={() => setCartOpen(true)} className="relative gap-2 rounded-lg">
            <ShoppingCart className="h-4 w-4" />
            Cart
            {cartCount > 0 && (
              <Badge className={`absolute -right-2 -top-2 h-5 min-w-5 rounded-full p-0 text-xs flex items-center justify-center ${hasUnavailable ? 'bg-destructive' : ''}`}>
                {cartCount}
              </Badge>
            )}
            {hasUnavailable && (
              <span className="absolute -right-1 -bottom-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main layout: product section + right sidebar */}
      <div className="flex gap-6 items-start">
        {/* Product section */}
        <div className="min-w-0 flex-1 space-y-6">

      {/* Search + Grid Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border/60 bg-card/50 py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
          />
        </div>

        {/* Grid column toggle */}
        <div className="flex items-center rounded-xl border border-border/60 bg-card/50 p-1 gap-0.5 shrink-0">
          {([
            { cols: 3 as const, icon: <LayoutGrid className="h-4 w-4" />, label: '3' },
            { cols: 6 as const, icon: <Grid3x3 className="h-4 w-4" />, label: '6' },
            { cols: 9 as const, icon: <Grid3x3 className="h-4 w-4"/>, label: '9' },
          ]).map(({ cols, icon, label }) => (
            <button
              key={cols}
              onClick={() => setGridCols(cols)}
              title={`${cols} columns`}
              aria-label={`${cols} columns`}
              className={`flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                gridCols === cols
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          {searchQuery ? (
            <>
              <Search className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No products match &ldquo;{searchQuery}&rdquo;</p>
              <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>Clear search</Button>
            </>
          ) : (
            <>
              <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-muted-foreground">No products available at this store yet.</p>
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

            return (
              <div key={product._id} className={`product-card-surface group rounded-xl hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden ${isOOS ? 'opacity-65 hover:opacity-80' : ''}`}>
                <div className="relative overflow-hidden group/img">
                  <ImageCarousel
                    images={product.images ?? []}
                    className={`w-full cursor-pointer ${isMini ? 'h-20' : isCompact ? 'h-32' : 'h-48'}`}
                    onClick={() => setSelectedProduct(product)}
                  />
                  {/* Hover overlay */}
                  {!isOOS && (
                    <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-2.5 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
                      {isMini ? (
                        <span className="flex items-center justify-center rounded-full bg-black/60 p-1 backdrop-blur-sm">
                          <Eye className="h-2.5 w-2.5 text-white" />
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                          <Eye className={`${isCompact ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                          {isCompact ? 'View reviews' : 'Click to view reviews'}
                        </span>
                      )}
                    </div>
                  )}
                  {isOOS && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                      <span className={`bg-red-600 text-white font-semibold rounded-full shadow-sm ${isMini ? 'text-[9px] px-1.5 py-0.5' : 'text-xs px-3 py-1.5'}`}>
                        {isMini ? 'OOS' : 'All Reserved'}
                      </span>
                    </div>
                  )}
                </div>

                <div className={`flex flex-col flex-1 ${isMini ? 'p-1.5' : isCompact ? 'p-2.5' : 'p-4'}`}>
                  <button className="text-left" onClick={() => setSelectedProduct(product)}>
                    <h3 className={`font-semibold transition-colors ${isOOS ? 'text-muted-foreground' : 'group-hover:text-primary'} ${isMini ? 'text-[10px] line-clamp-1' : isCompact ? 'text-xs line-clamp-1' : 'line-clamp-2'}`}>
                      {product.name}
                    </h3>
                  </button>

                  {/* Stars — hidden in mini mode */}
                  {!isMini && (() => {
                    const r = productRatings.get(product._id);
                    return r && r.totalCount > 0 ? (
                      <div className="mt-1">
                        <MiniStars value={r.averageStars} count={r.totalCount} />
                      </div>
                    ) : null;
                  })()}

                  <div className={`flex items-baseline justify-between gap-1 ${isMini ? 'mt-0.5' : 'mt-2'}`}>
                    <div>
                      <p className={`font-bold ${isOOS ? 'text-muted-foreground' : 'text-primary'} ${isMini ? 'text-[10px]' : isCompact ? 'text-sm' : 'text-xl'}`}>
                        {fmt(effectivePrice)}
                      </p>
                      {!isMini && discountPercent > 0 && (
                        <p className="text-xs text-muted-foreground">
                          <span className="line-through">{fmt(product.sellingPrice)}</span>{!isCompact && ` • ${discountPercent}% OFF`}
                        </p>
                      )}
                    </div>
                    {/* Stock indicator dot — always visible */}
                    {!isMini && (
                      isOOS ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" title="Out of stock" />
                      ) : (
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${product.stockQuantity < 10 ? 'bg-amber-500' : 'bg-green-500'}`} title={`${product.stockQuantity} left`} />
                      )
                    )}
                  </div>

                  {/* Stock label + in-cart note — normal mode only */}
                  {!isCompact && !isMini && (
                    <>
                      <div className="mt-1">
                        {isOOS ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />Reserved
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-1 text-xs ${product.stockQuantity < 10 ? 'text-amber-700 font-medium' : 'text-muted-foreground'}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${product.stockQuantity < 10 ? 'bg-amber-500' : 'bg-green-500'}`} />
                            {product.stockQuantity} left
                          </span>
                        )}
                      </div>
                      {inCart && (
                        <p className={`mt-1.5 text-xs font-medium ${isOOS ? 'text-red-600' : 'text-primary/80'}`}>
                          {inCart.quantity} in cart{isOOS ? ' (unavailable)' : ''}
                        </p>
                      )}
                    </>
                  )}

                  <div className={`mt-auto space-y-1.5 ${isMini ? 'pt-1' : 'pt-3'}`}>
                    {isMini ? (
                      /* Mini mode: opens product modal so user has full controls */
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className={`flex-1 flex items-center justify-center rounded-lg py-1 transition-colors ${
                            isOOS || available === 0
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                          }`}
                          title="View product details"
                        >
                          <ShoppingCart className="h-3 w-3" />
                        </button>
                        <a
                          href={`/products/${product._id}/rate`}
                          title="Rate product"
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
                      /* Compact mode: small qty picker + add button */
                      <>
                        {isOOS ? (
                          inCart ? (
                            <div className="rounded-md bg-red-50 border border-red-200 px-2 py-1 text-center">
                              <p className="text-[10px] text-red-700">Unavailable</p>
                            </div>
                          ) : (
                            <p className="text-center text-[10px] text-muted-foreground py-0.5">Unavailable</p>
                          )
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
                      /* Normal mode: full controls */
                      <>
                        {isOOS ? (
                          inCart ? (
                            <div className="rounded-lg bg-red-50 border border-red-200 px-2 py-1.5 text-center">
                              <p className="text-xs text-red-700">No longer available</p>
                            </div>
                          ) : (
                            <p className="text-center text-xs text-muted-foreground py-1">Currently unavailable</p>
                          )
                        ) : available > 0 ? (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Qty</span>
                              <QuantityPicker value={Math.min(cardQty, available)} max={available} onChange={(q) => setCardQty(product._id, q)} />
                            </div>
                            <Button className="w-full rounded-lg" size="sm" onClick={() => addToCartWithQty(product, Math.min(cardQty, available))} disabled={addToCartCooldowns.has(product._id)}>
                              {addToCartCooldowns.has(product._id) ? (
                                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Added!</>
                              ) : (
                                <><ShoppingCart className="mr-1.5 h-3.5 w-3.5" />Add to Cart</>
                              )}
                            </Button>
                          </>
                        ) : (
                          <p className="text-center text-xs text-muted-foreground py-1">All stock in cart</p>
                        )}
                        <a
                          href={`/products/${product._id}/rate`}
                          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            hasRated
                              ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          <Star className={`h-3 w-3 ${hasRated ? 'fill-amber-400 text-amber-400' : ''}`} />
                          Rate Product
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

        </div>{/* end product section */}

        {/* Right sidebar: Activity Feed + Trending */}
        <div className="hidden xl:flex w-72 shrink-0 flex-col gap-4">
          <ActivityFeed storeId={storeId} />
          <TopProducts storeId={storeId} hideRevenue defaultLimit={5} />
        </div>
      </div>{/* end main layout */}

      {/* Product Detail Dialog */}
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

      {/* Cart Dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reservation Cart</DialogTitle>
            <DialogDescription>Review items to reserve. Payment can be made upon claiming.</DialogDescription>
            {cart.length > 0 && (
              <Button variant="outline" size="sm" className="w-fit text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive mt-1" onClick={clearAllCart}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Clear all items
              </Button>
            )}
          </DialogHeader>

          {/* Unavailable items banner */}
          {hasUnavailable && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    {unavailableItems.length === 1
                      ? `"${unavailableItems[0].product.name}" is no longer available`
                      : `${unavailableItems.length} items are no longer available`}
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    These items were reserved by other customers. Remove them to continue with your reservation.
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="sm" className="mt-2 w-full" onClick={removeUnavailableFromCart}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove {unavailableItems.length} unavailable item{unavailableItems.length > 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {cart.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Your cart is empty.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {cart.map((item) => {
                const itemOOS = item.product.stockQuantity === 0;
                const overQuantity = item.quantity > item.product.stockQuantity && item.product.stockQuantity > 0;
                const effectivePrice = getEffectivePrice(item.product);
                const discountPercent = getDiscountPercent(item.product);
                return (
                  <div
                    key={item.product._id}
                    className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                      itemOOS ? 'border-red-300 bg-red-50' : overQuantity ? 'border-orange-300 bg-orange-50' : ''
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 rounded overflow-hidden relative">
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
                      <p className={`text-sm font-medium truncate ${itemOOS ? 'line-through text-muted-foreground' : ''}`}>{item.product.name}</p>
                      {itemOOS ? (
                        <p className="text-xs font-medium text-red-600">All reserved — please remove</p>
                      ) : overQuantity ? (
                        <p className="text-xs font-medium text-orange-600">Only {item.product.stockQuantity} left — quantity will be adjusted</p>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          <p>{fmt(effectivePrice)} x {item.quantity} = {fmt(effectivePrice * item.quantity)}</p>
                          {discountPercent > 0 && (
                            <p>
                              <span className="line-through">{fmt(item.product.sellingPrice)}</span> • {discountPercent}% OFF
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!itemOOS && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)} disabled={item.quantity <= 1}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{Math.min(item.quantity, item.product.stockQuantity)}</span>
                          <Button size="sm" variant="ghost" onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)} disabled={item.quantity >= item.product.stockQuantity}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeFromCart(item.product._id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {cart.length > 0 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{fmt(hasUnavailable ? validCartTotal : cartTotal)}</span>
            </div>
          )}

          <div className="space-y-2">
              <label htmlFor="reservation-notes" className="text-sm font-medium">Notes for your reservation (optional)</label>
              <textarea
                id="reservation-notes"
                className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="e.g. Preferred pickup time, special requests..."
                value={reservationNotes}
                onChange={(e) => setReservationNotes(e.target.value)}
                rows={3}
              />
            </div>

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCartOpen(false)}>Continue Shopping</Button>
            {cart.length > 0 && (
              <Button onClick={handleCheckout} disabled={checkoutLoading || hasUnavailable}>
                {hasUnavailable
                  ? 'Remove unavailable items first'
                  : checkoutLoading
                    ? 'Processing...'
                    : `Reserve Items (${fmt(hasUnavailable ? validCartTotal : cartTotal)})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ask / Recommend Dialog */}
      <Dialog open={interactionOpen} onOpenChange={(v) => { if (!v) { setInteractionOpen(false); setInteractionContent(''); setInteractionDone(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ask a Question or Suggest a Product</DialogTitle>
            <DialogDescription>
              Your message will be reviewed by the store team.
            </DialogDescription>
          </DialogHeader>

          {interactionDone ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-base font-semibold">Message sent!</p>
              <p className="text-sm text-muted-foreground">The store team will review your message.</p>
              <Button onClick={() => { setInteractionOpen(false); setInteractionContent(''); setInteractionDone(false); }}>Close</Button>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setInteractionType('question')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${interactionType === 'question' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    <HelpCircle className="h-4 w-4" />
                    Question
                  </button>
                  <button
                    type="button"
                    onClick={() => setInteractionType('recommendation')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${interactionType === 'recommendation' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}
                  >
                    <Lightbulb className="h-4 w-4" />
                    Recommendation
                  </button>
                </div>
                <textarea
                  value={interactionContent}
                  onChange={(e) => setInteractionContent(e.target.value)}
                  placeholder={interactionType === 'question' ? 'Ask about a product, availability, or anything else...' : 'Suggest a product you\'d like to see in this store...'}
                  maxLength={1000}
                  rows={4}
                  className="w-full resize-none rounded-xl border bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <p className="text-right text-xs text-muted-foreground">{interactionContent.length}/1000</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setInteractionOpen(false); setInteractionContent(''); }}>Cancel</Button>
                <Button
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
                  className="gap-2"
                >
                  {interactionSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Rate Store Dialog */}
      <Dialog
        open={storeRatingOpen}
        onOpenChange={(v) => {
          if (!v) {
            setStoreRatingOpen(false);
            setStoreRatingComment('');
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rate {storeName}</DialogTitle>
            <DialogDescription>
              {hasRatedStore ? 'Update your store rating.' : 'Share your overall experience with this store.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">Your rating</p>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStoreRatingStars(s)}
                    className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Star className={`h-8 w-8 transition-colors ${s <= storeRatingStars ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {['', 'Terrible', 'Poor', 'Average', 'Good', 'Excellent'][storeRatingStars]}
              </p>
            </div>
            <textarea
              value={storeRatingComment}
              onChange={(e) => setStoreRatingComment(e.target.value)}
              placeholder="Add a comment (optional)"
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-xl border bg-muted/20 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setStoreRatingOpen(false); setStoreRatingComment(''); }}
              disabled={storeRatingSubmitting}
            >
              Cancel
            </Button>
            <Button
              disabled={storeRatingSubmitting}
              className="gap-2"
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
                  toast.success('Thank you for rating the store!');
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

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservation Confirmed</DialogTitle>
            <DialogDescription>Your items have been reserved successfully. You can claim and pay at the store.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)}>Continue Shopping</Button>
            <Button variant="outline" asChild><a href="/purchases">View My Reservations</a></Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Options Modal */}
      <Dialog open={paymentOptionsOpen} onOpenChange={setPaymentOptionsOpen}>
        <DialogContent className="w-[min(96vw,50.6rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              Payment Options
            </DialogTitle>
            <DialogDescription>
              Scan a QR code or note the account details to pay for your reservation.
            </DialogDescription>
          </DialogHeader>

          {paymentOptionsLoading ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading payment options…</p>
            </div>
          ) : paymentOptions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <QrCode className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No payment options available for this store yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Option selector when multiple */}
              {paymentOptions.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {paymentOptions.map((opt) => (
                    <button
                      key={opt._id}
                      onClick={() => setSelectedPaymentOption(opt)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selectedPaymentOption?._id === opt._id
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card hover:bg-muted/60'
                      }`}
                    >
                      {opt.type === 'e-wallet'
                        ? <Wallet className="h-3 w-3" />
                        : <CreditCard className="h-3 w-3" />}
                      {opt.label || opt.recipientName}
                    </button>
                  ))}
                </div>
              )}

              {/* Selected option detail */}
              {selectedPaymentOption && (
                <div className="space-y-4">
                  {/* QR code */}
                  <div className="flex justify-center">
                    <PaymentQrImage
                      url={selectedPaymentOption.qrImageUrl}
                      label={selectedPaymentOption.label || selectedPaymentOption.recipientName}
                    />
                  </div>

                  {/* Info card */}
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      {selectedPaymentOption.type === 'e-wallet'
                        ? <Wallet className="h-4 w-4 text-muted-foreground" />
                        : <CreditCard className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground capitalize">{selectedPaymentOption.type}</span>
                      {selectedPaymentOption.label && (
                        <span className="ml-auto text-xs font-semibold">{selectedPaymentOption.label}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Recipient</p>
                        <p className="text-sm font-semibold">{selectedPaymentOption.recipientName}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedPaymentOption.recipientName);
                          toast.success('Recipient name copied!');
                        }}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Copy
                      </button>
                    </div>
                    {selectedPaymentOption.accountDetails && (
                      <div>
                        <p className="text-xs text-muted-foreground">Account</p>
                        <p className="text-sm font-medium">{selectedPaymentOption.accountDetails}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOptionsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentQrImage({ url, label }: { url: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-[min(78vw,23rem)] w-[min(78vw,23rem)] items-center justify-center rounded-xl border border-dashed border-border bg-muted">
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
      className="h-[min(78vw,23rem)] w-[min(78vw,23rem)] rounded-xl border border-border object-contain bg-white shadow-sm"
      onError={() => setFailed(true)}
    />
  );
}

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
import { AlertTriangle, ChevronLeft, ChevronRight, ImageIcon, Loader2, MapPin, Minus, Package, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { getSocket } from '@/lib/socket';

interface Product {
  _id: string;
  name: string;
  images: string[];
  sellingPrice: number;
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

interface ShopViewProps {
  storeId: string;
  storeName: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

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

function ProductDetailDialog({ product, open, onOpenChange, inCart, onAddToCart, isCooldown }: {
  product: Product | null; open: boolean; onOpenChange: (open: boolean) => void; inCart?: CartItem; onAddToCart: (p: Product, qty: number) => void; isCooldown?: boolean;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex flex-col md:flex-row">
          <div className="md:w-1/2 bg-muted/30 flex flex-col">
            <div className="relative aspect-square">
              {!hasImages || failedSet.has(selectedIndex) ? (
                <ImagePlaceholder className="h-full w-full" iconSize="h-12 w-12" />
              ) : (
                <SafeImage src={images[selectedIndex]} alt={product.name} className="h-full w-full" onError={() => setFailedSet((prev) => new Set(prev).add(selectedIndex))} />
              )}
              {isOOS && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="bg-red-600 text-white text-sm font-semibold px-3 py-1 rounded-full">All Reserved</span>
                </div>
              )}
              {images.length > 1 && (
                <>
                  <button onClick={() => setSelectedIndex((i) => (i - 1 + images.length) % images.length)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"><ChevronLeft className="h-5 w-5" /></button>
                  <button onClick={() => setSelectedIndex((i) => (i + 1) % images.length)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"><ChevronRight className="h-5 w-5" /></button>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {images.map((url, i) => (
                  <button key={i} onClick={() => setSelectedIndex(i)} className={`shrink-0 h-14 w-14 rounded-md overflow-hidden border-2 transition-colors ${i === selectedIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'}`}>
                    {failedSet.has(i) ? <ImagePlaceholder className="h-full w-full" iconSize="h-4 w-4" /> : <SafeImage src={url} alt="" className="h-full w-full" onError={() => setFailedSet((prev) => new Set(prev).add(i))} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="md:w-1/2 p-6 flex flex-col">
            <button onClick={() => onOpenChange(false)} className="absolute top-3 right-3 rounded-full p-1 hover:bg-muted transition-colors"><X className="h-4 w-4" /></button>
            <h2 className="text-xl font-bold pr-8">{product.name}</h2>
            <p className="mt-2 text-2xl font-bold text-primary">{fmt(product.sellingPrice)}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${isOOS ? 'bg-red-100 text-red-700' : product.stockQuantity < 10 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                {isOOS ? 'All Reserved' : `${product.stockQuantity} in stock`}
              </span>
              {cartQty > 0 && <span className="text-xs text-muted-foreground">({cartQty} in cart)</span>}
            </div>
            {hasImages && images.length > 1 && <p className="mt-2 text-xs text-muted-foreground">{images.length} photos available</p>}

            <div className="mt-auto pt-6 space-y-3">
              {isOOS ? (
                <div className="rounded-md bg-red-50 border border-red-200 p-3 text-center">
                  <p className="text-sm font-medium text-red-700">This item has been fully reserved by other customers.</p>
                  <p className="text-xs text-red-600 mt-1">Check back later for availability.</p>
                </div>
              ) : available > 0 ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Quantity</span>
                    <QuantityPicker value={qty} max={available} onChange={setQty} size="md" />
                  </div>
                  <p className="text-right text-sm text-muted-foreground">
                    Subtotal: <span className="font-medium text-foreground">{fmt(product.sellingPrice * qty)}</span>
                  </p>
                  <Button className="w-full" onClick={() => { onAddToCart(product, qty); setQty(1); }} disabled={isCooldown}>
                    {isCooldown ? (
                      <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Added to Cart</>
                    ) : (
                      <><ShoppingCart className="mr-1.5 h-4 w-4" />Add {qty} to Cart</>
                    )}
                  </Button>
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-2">All available stock is in your cart</p>
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

export function ShopView({ storeId, storeName }: ShopViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>({});
  const [addToCartCooldowns, setAddToCartCooldowns] = useState<Set<string>>(new Set());
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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

  useEffect(() => { fetchProducts(); }, []);

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

    socket.on('stock:updated', handleStockUpdate);
    return () => {
      socket.off('stock:updated', handleStockUpdate);
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

  const cartTotal = cart.reduce((sum, c) => sum + c.product.sellingPrice * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const unavailableItems = cart.filter((c) => c.product.stockQuantity === 0);
  const hasUnavailable = unavailableItems.length > 0;
  const validCartTotal = cart
    .filter((c) => c.product.stockQuantity > 0)
    .reduce((sum, c) => sum + c.product.sellingPrice * c.quantity, 0);

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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card/80 overflow-hidden flex flex-col">
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
          <a href="/select-location" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors">
            <MapPin className="h-3.5 w-3.5" />
            Change store
          </a>
          <a href="/purchases" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors">
            <Package className="h-3.5 w-3.5" />
            My Purchases
          </a>
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-card/50 py-2.5 pl-10 pr-4 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all"
        />
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const available = getAvailable(product);
            const cardQty = getCardQty(product._id);
            const inCart = getCartItem(product._id);
            const isOOS = product.stockQuantity === 0;

            return (
              <div key={product._id} className={`group rounded-xl border border-border/40 bg-card/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden ${isOOS ? 'opacity-65 hover:opacity-80' : ''}`}>
                <div className="relative overflow-hidden">
                  <ImageCarousel images={product.images ?? []} className="h-48 w-full cursor-pointer" onClick={() => setSelectedProduct(product)} />
                  {isOOS && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                      <span className="bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">All Reserved</span>
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <button className="text-left" onClick={() => setSelectedProduct(product)}>
                    <h3 className={`font-semibold line-clamp-2 transition-colors ${isOOS ? 'text-muted-foreground' : 'group-hover:text-primary'}`}>{product.name}</h3>
                  </button>
                  <div className="mt-2 flex items-baseline justify-between gap-2">
                    <p className={`text-xl font-bold ${isOOS ? 'text-muted-foreground' : 'text-primary'}`}>{fmt(product.sellingPrice)}</p>
                    {isOOS ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        Reserved
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

                  <div className="mt-auto pt-3 space-y-2">
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
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Detail Dialog */}
      <ProductDetailDialog
        product={selectedProduct}
        open={!!selectedProduct}
        onOpenChange={(open) => { if (!open) setSelectedProduct(null); }}
        inCart={selectedProduct ? getCartItem(selectedProduct._id) : undefined}
        onAddToCart={addToCartWithQty}
        isCooldown={selectedProduct ? addToCartCooldowns.has(selectedProduct._id) : false}
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
                        <p className="text-xs text-muted-foreground">
                          {fmt(item.product.sellingPrice)} x {item.quantity} = {fmt(item.product.sellingPrice * item.quantity)}
                        </p>
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
    </div>
  );
}

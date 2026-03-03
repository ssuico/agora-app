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
import { ChevronLeft, ChevronRight, ImageIcon, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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

interface ShopViewProps {
  storeId: string;
  storeName: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

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
        <SafeImage
          src={images[index]}
          alt=""
          className="h-full w-full"
          onError={() => markFailed(index)}
        />
      )}

      {hasMultiple && (
        <>
          <button
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={next}
            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white rounded-full p-1"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={(e) => goTo(i, e)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>

          <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {index + 1}/{total}
          </div>
        </>
      )}

      {/* Clickable hint */}
      {images.length > 0 && (
        <div className="absolute inset-0 cursor-pointer" />
      )}
    </div>
  );
}

function ProductDetailDialog({
  product,
  open,
  onOpenChange,
  inCart,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inCart?: CartItem;
  onAddToCart: (p: Product) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveFromCart: (id: string) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [failedSet, setFailedSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelectedIndex(0);
    setFailedSet(new Set());
  }, [product?._id]);

  if (!product) return null;

  const images = product.images ?? [];
  const hasImages = images.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="flex flex-col md:flex-row">
          {/* Image gallery */}
          <div className="md:w-1/2 bg-muted/30 flex flex-col">
            <div className="relative aspect-square">
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

              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedIndex((i) => (i - 1 + images.length) % images.length)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setSelectedIndex((i) => (i + 1) % images.length)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`shrink-0 h-14 w-14 rounded-md overflow-hidden border-2 transition-colors ${
                      i === selectedIndex
                        ? 'border-primary'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
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

          {/* Product details */}
          <div className="md:w-1/2 p-6 flex flex-col">
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 rounded-full p-1 hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-xl font-bold pr-8">{product.name}</h2>
            <p className="mt-2 text-2xl font-bold text-primary">{fmt(product.sellingPrice)}</p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  product.stockQuantity === 0
                    ? 'bg-red-100 text-red-700'
                    : product.stockQuantity < 10
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-green-100 text-green-700'
                }`}
              >
                {product.stockQuantity > 0
                  ? `${product.stockQuantity} in stock`
                  : 'Out of stock'}
              </span>
            </div>

            {hasImages && images.length > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {images.length} photos available
              </p>
            )}

            <div className="mt-auto pt-6">
              {inCart ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateQuantity(product._id, -1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-10 text-center text-lg font-semibold">
                      {inCart.quantity}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateQuantity(product._id, 1)}
                      disabled={inCart.quantity >= product.stockQuantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        onRemoveFromCart(product._id);
                      }}
                    >
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                    <p className="flex-1 flex items-center justify-center text-sm font-medium">
                      Subtotal: {fmt(product.sellingPrice * inCart.quantity)}
                    </p>
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => onAddToCart(product)}
                  disabled={product.stockQuantity === 0}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add to Cart
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShopView({ storeId, storeName }: ShopViewProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`/api/products?storeId=${storeId}`);
      if (res.ok) {
        const data: Product[] = await res.json();
        setProducts(data.filter((p) => p.stockQuantity > 0));
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product._id === product._id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) return prev;
        return prev.map((c) =>
          c.product._id === product._id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product._id !== productId) return c;
          const newQty = c.quantity + delta;
          if (newQty <= 0) return null;
          if (newQty > c.product.stockQuantity) return c;
          return { ...c, quantity: newQty };
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product._id !== productId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.product.sellingPrice * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutLoading(true);
    setError('');

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          items: cart.map((c) => ({
            productId: c.product._id,
            quantity: c.quantity,
          })),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Checkout failed');
        return;
      }

      setCart([]);
      setCartOpen(false);
      setSuccessOpen(true);
      await fetchProducts();
    } catch {
      setError('Network error');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const getCartItem = (productId: string) => cart.find((c) => c.product._id === productId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading products...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{storeName}</h1>
          <p className="text-sm text-muted-foreground">Browse products and add to cart</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/select-location" className="text-sm text-primary hover:underline mr-4">
            Change store
          </a>
          <a href="/purchases" className="text-sm text-primary hover:underline mr-4">
            My Purchases
          </a>
          <Button variant="outline" onClick={() => setCartOpen(true)} className="relative">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart
            {cartCount > 0 && (
              <Badge className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                {cartCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {products.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No products available at this store yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => {
            const inCart = getCartItem(product._id);
            return (
              <div
                key={product._id}
                className="rounded-lg border bg-card shadow-sm flex flex-col overflow-hidden"
              >
                <ImageCarousel
                  images={product.images ?? []}
                  className="h-44 w-full cursor-pointer"
                  onClick={() => setSelectedProduct(product)}
                />
                <div className="p-4 flex flex-col flex-1">
                  <button
                    className="text-left"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <h3 className="font-semibold hover:text-primary transition-colors">{product.name}</h3>
                  </button>
                  <p className="mt-1 text-lg font-bold text-primary">
                    {fmt(product.sellingPrice)}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {product.stockQuantity} in stock
                    </span>
                    {(product.images?.length ?? 0) > 1 && (
                      <span className="text-xs text-muted-foreground/60">
                        {product.images.length} photos
                      </span>
                    )}
                  </div>
                  <div className="mt-auto pt-3">
                    {inCart ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(product._id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-sm font-medium">
                            {inCart.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(product._id, 1)}
                            disabled={inCart.quantity >= product.stockQuantity}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeFromCart(product._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        size="sm"
                        onClick={() => addToCart(product)}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Add to Cart
                      </Button>
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
        onAddToCart={addToCart}
        onUpdateQuantity={updateQuantity}
        onRemoveFromCart={removeFromCart}
      />

      {/* Cart Dialog */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Shopping Cart</DialogTitle>
            <DialogDescription>Review your items before checkout.</DialogDescription>
          </DialogHeader>

          {cart.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Your cart is empty.</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.product._id}
                  className="flex items-center gap-3 rounded-md border px-3 py-2"
                >
                  <div className="h-10 w-10 shrink-0 rounded overflow-hidden">
                    {item.product.images?.[0] ? (
                      <img src={item.product.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlaceholder className="h-full w-full" iconSize="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(item.product.sellingPrice)} x {item.quantity} ={' '}
                      {fmt(item.product.sellingPrice * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateQuantity(item.product._id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateQuantity(item.product._id, 1)}
                      disabled={item.quantity >= item.product.stockQuantity}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeFromCart(item.product._id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-bold">{fmt(cartTotal)}</span>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCartOpen(false)}>
              Continue Shopping
            </Button>
            {cart.length > 0 && (
              <Button onClick={handleCheckout} disabled={checkoutLoading}>
                {checkoutLoading ? 'Processing...' : `Checkout (${fmt(cartTotal)})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Complete</DialogTitle>
            <DialogDescription>
              Your order has been placed successfully. Thank you for shopping!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)}>Continue Shopping</Button>
            <Button variant="outline" asChild>
              <a href="/purchases">View Purchases</a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

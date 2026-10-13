import { MapPin, MessageSquare, Package, ShoppingBag, Star, Store } from 'lucide-react';
import { PreviewFrame } from './PreviewFrame';

const products = [
  { name: 'Trail Mix', price: '$4.50', was: '$5.25', stock: 'In stock', stockTone: 'text-success-ink', stars: 4 },
  { name: 'Camp Mug', price: '$12.00', was: null, stock: 'Low', stockTone: 'text-warning-ink', stars: 5 },
  { name: 'Rain Shell', price: '$48.00', was: null, stock: 'In stock', stockTone: 'text-success-ink', stars: 4 },
  { name: 'Fire Starter', price: '$8.00', was: null, stock: 'Out', stockTone: 'text-error-ink', stars: 3 },
];

function Stars({ count }: { count: number }) {
  return (
    <span className="flex gap-0.5 text-rating">
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={`size-2.5 ${index < count ? 'fill-rating' : 'fill-transparent text-border'}`}
        />
      ))}
    </span>
  );
}

function StorefrontMock() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-[11px] text-foreground">
      <div className="flex h-16 items-end bg-operational-subtle px-3 pb-2">
        <div>
          <p className="text-sm font-semibold leading-none">Ridge Outfitters</p>
          <p className="mt-1 text-[10px] text-operational">Open · North Ridge</p>
        </div>
      </div>
      <div className="flex gap-1 border-b border-border px-2 py-1.5">
        <span className="rounded-md bg-primary-subtle px-2 py-0.5 font-semibold">Products</span>
        <span className="px-2 py-0.5 text-muted-foreground">Pre-Orders</span>
      </div>
      <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
        <div className="grid grid-cols-2 gap-2">
          {products.map((product) => (
            <div key={product.name} className="rounded-md border border-border p-1.5">
              <div className="mb-1.5 flex h-9 items-center justify-center rounded bg-muted">
                <Package className="size-3.5 text-muted-foreground" />
              </div>
              <p className="truncate font-semibold leading-tight">{product.name}</p>
              <p className="mt-0.5 flex items-baseline gap-1">
                <span className="font-semibold text-primary">{product.price}</span>
                {product.was && <span className="text-[10px] text-muted-foreground line-through">{product.was}</span>}
              </p>
              <div className="mt-1 flex items-center justify-between gap-1">
                <Stars count={product.stars} />
                <span className={`text-[10px] font-medium ${product.stockTone}`}>{product.stock}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <div className="rounded-md border border-border bg-muted p-2">
            <p className="flex items-center gap-1 font-semibold">
              <ShoppingBag className="size-3" />
              Cart
            </p>
            <p className="mt-1.5 flex justify-between gap-2">
              <span className="truncate">Trail Mix × 2</span>
              <span className="tabular-nums">$9.00</span>
            </p>
            <p className="mt-2 rounded-md bg-primary px-2 py-1 text-center font-semibold text-primary-foreground">
              Reserve
            </p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="font-semibold">Pay with QR</p>
            <div className="mt-1.5 grid w-10 grid-cols-4 gap-0.5">
              {Array.from({ length: 16 }, (_, index) => (
                <span
                  key={index}
                  className={`size-1.5 ${index % 3 === 0 ? 'bg-foreground' : 'bg-muted'}`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">GCash · copy to pay</p>
          </div>
          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MessageSquare className="size-3 shrink-0" />
            Message the store
          </p>
        </div>
      </div>
    </div>
  );
}

function LocationMock() {
  const stores = [
    { name: 'Ridge Outfitters', state: 'Open', tone: 'text-success-ink' },
    { name: 'Summit Supply', state: 'Pre-orders', tone: 'text-operational' },
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-[11px] text-foreground">
      <p className="text-xs font-semibold">North Ridge</p>
      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
        <MapPin className="size-3" />
        2 stores
      </p>
      <div className="mt-2 flex flex-col gap-1.5">
        {stores.map((store) => (
          <div key={store.name} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-operational-subtle text-operational">
              <Store className="size-3" />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{store.name}</span>
            <span className={`text-[10px] font-semibold ${store.tone}`}>{store.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PurchasesMock() {
  const rows = [
    { item: 'Trail Mix', status: 'active', tone: 'bg-success-soft text-success-ink', action: 'Request cancellation' },
    { item: 'Camp Mug', status: 'completed', tone: 'bg-muted text-foreground', action: '' },
    { item: 'Rain Shell', status: 'cancelled', tone: 'bg-error-soft text-error-ink', action: '' },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-[11px] text-foreground">
      <p className="border-b border-border px-2.5 py-2 text-xs font-semibold">My Purchases</p>
      <ul>
        {rows.map((row) => (
          <li key={row.item} className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{row.item}</span>
              {row.action && <span className="text-[10px] font-medium text-primary">{row.action}</span>}
            </span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ${row.tone}`}>
              {row.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CustomerPreviews() {
  return (
    <div className="flex flex-col gap-4">
      <PreviewFrame
        path="/shop/ridge-outfitters"
        caption="The storefront: banner, products and pre-orders, ratings, a cart you reserve from, and the store's QR payment options."
      >
        <StorefrontMock />
      </PreviewFrame>
      <div className="grid gap-4 sm:grid-cols-2">
        <PreviewFrame
          path="/select-location"
          caption="Pick a location, then a store. A closed store can still take pre-orders."
        >
          <LocationMock />
        </PreviewFrame>
        <PreviewFrame
          path="/purchases"
          caption="My Purchases lists active, completed, and cancelled orders. Active orders can request a cancellation."
        >
          <PurchasesMock />
        </PreviewFrame>
      </div>
    </div>
  );
}

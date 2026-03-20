import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Package, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductInfo {
  _id: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
}

interface SoldStat {
  productId: string;
  name: string;
  totalSold: number;
  totalRevenue: number;
}

interface MergedProduct {
  productId: string;
  name: string;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
  totalSold: number;
  totalRevenue: number;
}

interface ProductSalesTableProps {
  storeId: string;
}

type SortKey = 'name' | 'totalSold' | 'totalRevenue' | 'stockQuantity' | 'sellingPrice' | 'costPrice';
type SortDir = 'asc' | 'desc';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

export function ProductSalesTable({ storeId }: ProductSalesTableProps) {
  const [products, setProducts] = useState<MergedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalSold');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [productsRes, statsRes] = await Promise.all([
        fetch(`/api/products?storeId=${storeId}`),
        fetch(`/api/products/sold-stats?storeId=${storeId}&limit=0`),
      ]);

      if (!productsRes.ok) throw new Error('Failed to load products');

      const allProducts: ProductInfo[] = await productsRes.json();
      const soldStats: SoldStat[] = statsRes.ok ? await statsRes.json() : [];

      const statsMap = new Map(soldStats.map((s) => [s.productId, s]));

      const merged: MergedProduct[] = allProducts.map((p) => {
        const stat = statsMap.get(p._id);
        return {
          productId: p._id,
          name: p.name,
          sellingPrice: p.sellingPrice,
          costPrice: p.costPrice,
          stockQuantity: p.stockQuantity,
          totalSold: stat?.totalSold ?? 0,
          totalRevenue: stat?.totalRevenue ?? 0,
        };
      });

      setProducts(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [storeId]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;

    list = [...list].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc'
          ? aVal.localeCompare(bVal, undefined, { sensitivity: 'base' })
          : bVal.localeCompare(aVal, undefined, { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

    return list;
  }, [products, searchQuery, sortKey, sortDir]);

  const maxSold = useMemo(() => Math.max(...products.map((p) => p.totalSold), 1), [products]);

  const totalRevenue = useMemo(() => products.reduce((s, p) => s + p.totalRevenue, 0), [products]);
  const totalSold = useMemo(() => products.reduce((s, p) => s + p.totalSold, 0), [products]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">All Products</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              ({products.length} product{products.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-input bg-background py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 w-52"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary row */}
      {!loading && !error && products.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="rounded-lg border bg-card px-4 py-2.5">
            <span className="text-muted-foreground">Total Revenue: </span>
            <span className="font-semibold">{fmt(totalRevenue)}</span>
          </div>
          <div className="rounded-lg border bg-card px-4 py-2.5">
            <span className="text-muted-foreground">Total Units Sold: </span>
            <span className="font-semibold">{totalSold.toLocaleString()}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No products in this store yet</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm">
                <tr className="border-b">
                  <th className="w-10 px-4 py-3 text-right font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left">
                    <button onClick={() => handleSort('name')} className="flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Product <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => handleSort('totalSold')} className="ml-auto flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Units Sold <SortIcon col="totalSold" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => handleSort('totalRevenue')} className="ml-auto flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Revenue <SortIcon col="totalRevenue" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => handleSort('sellingPrice')} className="ml-auto flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Price <SortIcon col="sellingPrice" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => handleSort('costPrice')} className="ml-auto flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Cost <SortIcon col="costPrice" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button onClick={() => handleSort('stockQuantity')} className="ml-auto flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Stock <SortIcon col="stockQuantity" />
                    </button>
                  </th>
                  <th className="px-4 py-3 w-36">
                    <span className="font-medium text-muted-foreground">Sales</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No products match "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filtered.map((product, index) => {
                    const barWidth = maxSold > 0 ? Math.round((product.totalSold / maxSold) * 100) : 0;
                    return (
                      <tr key={product.productId} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-medium">{product.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold">
                          {product.totalSold.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmt(product.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmt(product.sellingPrice)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {fmt(product.costPrice)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              product.stockQuantity === 0
                                ? 'text-red-600'
                                : product.stockQuantity < 10
                                ? 'text-amber-600'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                product.stockQuantity === 0
                                  ? 'bg-red-500'
                                  : product.stockQuantity < 10
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                              }`}
                            />
                            {product.stockQuantity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-primary/70 transition-all"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

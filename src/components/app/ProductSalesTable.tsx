import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Package, PackageCheck, PackageX, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
    if (sortKey !== col) return <ArrowUpDown className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp /> : <ArrowDown />;
  };

  const sortHeadButtonClass = '-mr-2 ml-auto text-muted-foreground hover:text-foreground';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-operational" />
          <h2 className="text-lg font-semibold">All Products</h2>
          {!loading && (
            <span className="text-sm text-muted-foreground">
              ({products.length} product{products.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-52 pl-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData} className="text-xs">
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        </div>
      </div>

      {!loading && !error && products.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <Card className="gap-0 py-2.5">
            <CardContent className="px-4">
              <span className="text-muted-foreground">Total Revenue: </span>
              <span className="font-semibold">{fmt(totalRevenue)}</span>
            </CardContent>
          </Card>
          <Card className="gap-0 py-2.5">
            <CardContent className="px-4">
              <span className="text-muted-foreground">Total Units Sold: </span>
              <span className="font-semibold">{totalSold.toLocaleString()}</span>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : products.length === 0 ? (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Package />
            </EmptyMedia>
            <EmptyDescription>No products in this store yet</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="max-h-150 overflow-y-auto px-0">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="border-b">
                  <th className="w-10 px-4 py-3 text-right font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleSort('name')}
                      className="-ml-2 text-muted-foreground hover:text-foreground"
                    >
                      Product <SortIcon col="name" />
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <Button variant="ghost" size="xs" onClick={() => handleSort('totalSold')} className={sortHeadButtonClass}>
                      Units Sold <SortIcon col="totalSold" />
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <Button variant="ghost" size="xs" onClick={() => handleSort('totalRevenue')} className={sortHeadButtonClass}>
                      Revenue <SortIcon col="totalRevenue" />
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <Button variant="ghost" size="xs" onClick={() => handleSort('sellingPrice')} className={sortHeadButtonClass}>
                      Price <SortIcon col="sellingPrice" />
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <Button variant="ghost" size="xs" onClick={() => handleSort('costPrice')} className={sortHeadButtonClass}>
                      Cost <SortIcon col="costPrice" />
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <Button variant="ghost" size="xs" onClick={() => handleSort('stockQuantity')} className={sortHeadButtonClass}>
                      Stock <SortIcon col="stockQuantity" />
                    </Button>
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
                                ? 'text-error'
                                : product.stockQuantity < 10
                                ? 'text-warning'
                                : 'text-operational'
                            }`}
                          >
                            {product.stockQuantity === 0 ? (
                              <PackageX className="size-3.5" />
                            ) : product.stockQuantity < 10 ? (
                              <AlertTriangle className="size-3.5" />
                            ) : (
                              <PackageCheck className="size-3.5" />
                            )}
                            {product.stockQuantity}
                            {product.stockQuantity === 0 ? ' · Out' : product.stockQuantity < 10 ? ' · Low' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Progress value={barWidth} className="h-1.5" />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

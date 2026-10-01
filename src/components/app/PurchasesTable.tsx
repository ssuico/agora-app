import { useState } from 'react';
import { Fragment } from 'react';
import { ChevronDown, ChevronRight, Receipt } from 'lucide-react';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

interface PurchaseItem {
  productId?: string;
  productName: string;
  quantity: number;
  subtotal: number;
  sellingPrice: number;
}

interface Purchase {
  _id: string;
  storeId: { _id: string; name: string } | string | null;
  totalAmount: number;
  createdAt: string;
  orderStatus?: string;
  items?: PurchaseItem[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function getStoreName(storeId: { _id: string; name: string } | string | null | undefined): string {
  if (storeId == null) return '—';
  if (typeof storeId === 'object') return storeId.name ?? '—';
  const s = String(storeId).trim();
  return s === '' || s === 'null' ? '—' : s.length > 8 ? s.slice(-8) : s;
}

export function PurchasesTable({ purchases }: { purchases: Purchase[] }) {
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const paginated = purchases.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="flex flex-1 flex-col p-0">
      <div className="data-table-scroll-wrapper purchases-table-scroll flex-1 min-h-[320px]">
        <table className="data-table purchases-table">
          <thead>
            <tr>
              <th className="w-10 px-3 py-3" aria-label="Details" />
              <th className="px-4 py-3 text-left font-semibold">Order ID</th>
              <th className="px-4 py-3 text-left font-semibold">Store</th>
              <th className="px-4 py-3 text-right font-semibold">Total</th>
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <Empty className="border-0 p-4 md:p-4">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Receipt /></EmptyMedia>
                      <EmptyTitle>No purchases yet</EmptyTitle>
                      <EmptyDescription>Your order history will appear here.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </td>
              </tr>
            ) : (
              paginated.map((tx) => {
                const isExpanded = expandedIds.has(tx._id);
                const items = tx.items ?? [];
                const hasItems = items.length > 0;
                const isActive = tx.orderStatus !== 'cancelled';
                return (
                  <Fragment key={tx._id}>
                    <tr
                      className={`transition-colors ${hasItems ? 'cursor-pointer' : ''} ${isExpanded ? 'purchases-row-active' : 'hover:bg-muted/40 active:bg-muted/60'}`}
                      onClick={() => hasItems && toggleExpanded(tx._id)}
                    >
                      <td className="w-10 px-3 py-3 align-middle">
                        {hasItems ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0 text-muted-foreground hover:text-foreground"
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(tx._id);
                            }}
                          >
                            {isExpanded ? <ChevronDown /> : <ChevronRight />}
                          </Button>
                        ) : (
                          <span className="inline-block w-8" />
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-muted-foreground">{tx._id.slice(-8)}</td>
                      <td className="px-4 py-3 font-medium">{getStoreName(tx.storeId)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmt(tx.totalAmount)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant={isActive ? 'success' : 'secondary'}>
                          {tx.orderStatus ?? 'active'}
                        </Badge>
                      </td>
                    </tr>
                    {isExpanded && hasItems && (
                      <tr key={`${tx._id}-items`} className="purchases-row-expanded">
                        <td colSpan={6} className="p-0 border-t border-border">
                          <div className="px-6 py-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Order items</p>
                            <table className="purchases-items-table w-full text-sm border border-border/60 rounded-lg overflow-hidden">
                              <thead>
                                <tr className="bg-muted/50 text-left">
                                  <th className="px-4 py-2.5 font-medium">Product</th>
                                  <th className="px-4 py-2.5 font-medium text-center w-20">Qty</th>
                                  <th className="px-4 py-2.5 font-medium text-right w-28">Unit price</th>
                                  <th className="px-4 py-2.5 font-medium text-right w-28">Subtotal</th>
                                  <th className="px-4 py-2.5 font-medium text-center w-28">Rate</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => (
                                  <tr key={idx} className="border-t border-border/40 bg-background/80">
                                    <td className="px-4 py-2.5 font-medium">{item.productName}</td>
                                    <td className="px-4 py-2.5 text-center">{item.quantity}</td>
                                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                                      {item.quantity > 0 ? fmt(item.subtotal / item.quantity) : '—'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{fmt(item.subtotal)}</td>
                                    <td className="px-4 py-2.5 text-center">
                                      {item.productId ? (
                                        <Button asChild variant="outline" size="xs">
                                          <a
                                            href={`/products/${item.productId}/rate`}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Rate
                                          </a>
                                        </Button>
                                      ) : (
                                        <span className="text-xs text-muted-foreground/40">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </CardContent>
      {purchases.length > 0 && (
        <CardFooter className="block bg-muted/20 p-0">
          <TablePagination
            currentPage={page}
            totalItems={purchases.length}
            onPageChange={setPage}
            label="purchases"
          />
        </CardFooter>
      )}
    </Card>
  );
}

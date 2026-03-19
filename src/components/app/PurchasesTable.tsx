import { useState } from 'react';
import { Fragment } from 'react';
import { ChevronDown, ChevronRight, Receipt } from 'lucide-react';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import { Button } from '@/components/ui/button';

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
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex flex-col">
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
                  <Receipt className="mx-auto h-10 w-10 opacity-40 mb-2" />
                  <p className="font-medium">No purchases yet</p>
                  <p className="text-sm mt-1">Your order history will appear here.</p>
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
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            aria-expanded={isExpanded}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpanded(tx._id);
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
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
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {tx.orderStatus ?? 'active'}
                        </span>
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
                                        <a
                                          href={`/products/${item.productId}/rate`}
                                          onClick={(e) => e.stopPropagation()}
                                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                        >
                                          Rate
                                        </a>
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
      {purchases.length > 0 && (
        <div className="border-t border-border bg-muted/20">
          <TablePagination
            currentPage={page}
            totalItems={purchases.length}
            onPageChange={setPage}
            label="purchases"
          />
        </div>
      )}
    </div>
  );
}

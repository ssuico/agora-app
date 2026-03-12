import { useState } from 'react';
import { Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';

interface PurchaseItem {
  productName: string;
  quantity: number;
  subtotal: number;
  sellingPrice: number;
}

interface Purchase {
  _id: string;
  storeId: { _id: string; name: string } | string;
  totalAmount: number;
  createdAt: string;
  items?: PurchaseItem[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function getStoreName(storeId: { _id: string; name: string } | string): string {
  if (typeof storeId === 'object' && storeId !== null) return storeId.name;
  return String(storeId).slice(-8);
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
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="data-table-scroll-wrapper flex-1 min-h-0">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8" aria-label="Expand" />
              <th>Order ID</th>
              <th>Store</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No purchases yet
                </td>
              </tr>
            ) : (
              paginated.map((tx) => {
                const isExpanded = expandedIds.has(tx._id);
                const items = tx.items ?? [];
                const hasItems = items.length > 0;
                return (
                  <Fragment key={tx._id}>
                    <tr
                      key={tx._id}
                      className={hasItems ? 'cursor-pointer hover:bg-muted/50' : ''}
                      onClick={() => hasItems && toggleExpanded(tx._id)}
                    >
                      <td className="w-8">
                        {hasItems ? (
                          <button
                            type="button"
                            className="p-0.5 rounded text-muted-foreground hover:text-foreground"
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
                          </button>
                        ) : (
                          <span className="inline-block w-4" />
                        )}
                      </td>
                      <td className="font-mono text-xs text-muted-foreground">{tx._id.slice(-8)}</td>
                      <td className="font-medium">{getStoreName(tx.storeId)}</td>
                      <td className="font-medium">{fmt(tx.totalAmount)}</td>
                      <td className="text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</td>
                    </tr>
                    {isExpanded && hasItems && (
                      <tr key={`${tx._id}-items`}>
                        <td colSpan={5} className="bg-muted/30 p-0">
                          <div className="px-4 py-3 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Items</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-muted-foreground border-b border-border/60">
                                  <th className="pb-1.5 font-medium">Product</th>
                                  <th className="pb-1.5 font-medium text-right w-20">Qty</th>
                                  <th className="pb-1.5 font-medium text-right w-24">Unit price</th>
                                  <th className="pb-1.5 font-medium text-right w-24">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, idx) => (
                                  <tr key={idx} className="border-b border-border/40 last:border-0">
                                    <td className="py-1.5 font-medium">{item.productName}</td>
                                    <td className="py-1.5 text-right">{item.quantity}</td>
                                    <td className="py-1.5 text-right text-muted-foreground">{fmt(item.sellingPrice)}</td>
                                    <td className="py-1.5 text-right">{fmt(item.subtotal)}</td>
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
        <TablePagination
          currentPage={page}
          totalItems={purchases.length}
          onPageChange={setPage}
          label="purchases"
        />
      )}
    </div>
  );
}

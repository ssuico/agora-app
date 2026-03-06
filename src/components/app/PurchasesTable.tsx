import { useState } from 'react';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';

interface Purchase {
  _id: string;
  storeId: { _id: string; name: string } | string;
  totalAmount: number;
  createdAt: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function getStoreName(storeId: { _id: string; name: string } | string): string {
  if (typeof storeId === 'object' && storeId !== null) return storeId.name;
  return String(storeId).slice(-8);
}

export function PurchasesTable({ purchases }: { purchases: Purchase[] }) {
  const [page, setPage] = useState(1);
  const paginated = purchases.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
      <div className="data-table-scroll-wrapper flex-1 min-h-0">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Store</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No purchases yet
                </td>
              </tr>
            ) : (
              paginated.map((tx) => (
                <tr key={tx._id}>
                  <td className="font-mono text-xs text-muted-foreground">{tx._id.slice(-8)}</td>
                  <td className="font-medium">{getStoreName(tx.storeId)}</td>
                  <td className="font-medium">{fmt(tx.totalAmount)}</td>
                  <td className="text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</td>
                </tr>
              ))
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

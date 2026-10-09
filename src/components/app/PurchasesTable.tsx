import { useState } from 'react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import { Ban, ChevronDown, ChevronRight, Receipt } from 'lucide-react';
import { TablePagination, ITEMS_PER_PAGE } from '@/components/ui/table-pagination';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

interface PurchaseItem {
  productId?: string;
  productName: string;
  quantity: number;
  subtotal: number;
  sellingPrice: number;
}

interface CancellationRequest {
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  requestedAt: string;
  resolvedAt?: string | null;
  responseNote?: string | null;
}

interface Purchase {
  _id: string;
  cancellationRequest?: CancellationRequest | null;
  storeId: { _id: string; name: string } | string | null;
  totalAmount: number;
  createdAt: string;
  orderStatus?: string;
  orderType?: 'regular' | 'walk-in' | 'preorder';
  claimStatus?: string;
  paymentStatus?: string;
  items?: PurchaseItem[];
}

function OrderTypeBadge({ orderType }: { orderType?: Purchase['orderType'] }) {
  if (orderType === 'preorder') return <Badge variant="warning">PRE-ORDER</Badge>;
  if (orderType === 'walk-in') return <Badge variant="info">WALK-IN</Badge>;
  return <Badge variant="outline">REGULAR</Badge>;
}

function getOrderStatusLabel(tx: Purchase): 'active' | 'completed' | 'cancelled' {
  if (tx.orderStatus === 'cancelled') return 'cancelled';
  return tx.claimStatus === 'claimed' && tx.paymentStatus === 'paid' ? 'completed' : 'active';
}

const COLUMN_COUNT = 8;
const MIN_CANCEL_REASON_WORDS = 2;
const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The customer can ask to cancel until the order is claimed, unless a request is already waiting. */
function canRequestCancellation(tx: Purchase): boolean {
  return (
    tx.orderStatus !== 'cancelled' &&
    tx.claimStatus !== 'claimed' &&
    tx.cancellationRequest?.status !== 'pending'
  );
}

/** One column for everything about cancelling: the action, or where the request stands. */
function CancellationCell({ tx, onRequest }: { tx: Purchase; onRequest: () => void }) {
  const request = tx.cancellationRequest;
  const isCancelled = tx.orderStatus === 'cancelled';

  if (isCancelled) {
    return request?.status === 'approved' ? (
      <Badge variant="secondary">Approved by store</Badge>
    ) : (
      <span className="text-muted-foreground/60">—</span>
    );
  }

  if (request?.status === 'pending') {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge variant="warning">Awaiting store approval</Badge>
        <span className="text-xs text-muted-foreground">Order stays active until then</span>
      </div>
    );
  }

  const canRequest = canRequestCancellation(tx);
  const declined = request?.status === 'rejected';

  if (!canRequest && !declined) {
    return <span className="text-muted-foreground/60">—</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {declined && (
        <div className="flex max-w-56 flex-col items-start gap-1">
          <Badge variant="error">Declined by store</Badge>
          {request?.responseNote && (
            <p className="line-clamp-2 text-xs text-muted-foreground" title={request.responseNote}>
              “{request.responseNote}”
            </p>
          )}
        </div>
      )}
      {canRequest && (
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRequest();
          }}
        >
          <Ban data-icon="inline-start" />
          {declined ? 'Ask again' : 'Cancel order'}
        </Button>
      )}
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);

function getStoreName(storeId: { _id: string; name: string } | string | null | undefined): string {
  if (storeId == null) return '—';
  if (typeof storeId === 'object') return storeId.name ?? '—';
  const s = String(storeId).trim();
  return s === '' || s === 'null' ? '—' : s.length > 8 ? s.slice(-8) : s;
}

export function PurchasesTable({ purchases: initialPurchases }: { purchases: Purchase[] }) {
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [cancelTarget, setCancelTarget] = useState<Purchase | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const paginated = purchases.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const closeCancelDialog = () => {
    if (cancelSubmitting) return;
    setCancelTarget(null);
    setCancelReason('');
  };

  const submitCancelRequest = async () => {
    if (!cancelTarget) return;
    setCancelSubmitting(true);
    try {
      const res = await fetch(`/api/transactions/${cancelTarget._id}/cancel-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      const data = (await res.json()) as Partial<Purchase> & { message?: string };
      if (!res.ok) {
        toast.error(data.message ?? 'Could not send your cancellation request');
        return;
      }
      setPurchases((prev) =>
        prev.map((p) =>
          p._id === cancelTarget._id
            ? { ...p, cancellationRequest: data.cancellationRequest ?? null }
            : p
        )
      );
      toast.success('Cancellation request sent. The store will review it.');
      setCancelTarget(null);
      setCancelReason('');
    } catch {
      toast.error('Could not send your cancellation request');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const reasonTooShort = countWords(cancelReason) < MIN_CANCEL_REASON_WORDS;

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
      <div className="data-table-scroll-wrapper purchases-table-scroll flex-1">
        <table className="data-table purchases-table">
          <thead>
            <tr>
              <th className="w-12" aria-label="Details" />
              <th className="text-left font-semibold">Order ID</th>
              <th className="text-left font-semibold">Store</th>
              <th className="text-left font-semibold">Date</th>
              <th className="text-right font-semibold">Total</th>
              <th className="text-left font-semibold">Type</th>
              <th className="text-left font-semibold">Status</th>
              <th className="text-left font-semibold">Cancellation</th>
            </tr>
          </thead>
          <tbody>
            {purchases.length === 0 ? (
              <tr>
                <td colSpan={COLUMN_COUNT} className="py-12 text-center text-muted-foreground">
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
                const orderStatusLabel = getOrderStatusLabel(tx);
                return (
                  <Fragment key={tx._id}>
                    <tr
                      className={`transition-colors ${hasItems ? 'cursor-pointer' : ''} ${isExpanded ? 'purchases-row-active' : 'hover:bg-muted/40 active:bg-muted/60'}`}
                      onClick={() => hasItems && toggleExpanded(tx._id)}
                    >
                      <td className="w-12 align-middle">
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
                      <td className="font-mono text-sm text-muted-foreground">{tx._id.slice(-8)}</td>
                      <td className="font-medium">{getStoreName(tx.storeId)}</td>
                      <td>
                        <p className="text-sm font-medium">
                          {new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </td>
                      <td className="text-right font-semibold tabular-nums">{fmt(tx.totalAmount)}</td>
                      <td>
                        <OrderTypeBadge orderType={tx.orderType} />
                      </td>
                      <td>
                        <Badge variant={isActive ? 'success' : 'secondary'} className="capitalize">{orderStatusLabel}</Badge>
                      </td>
                      <td className="whitespace-normal">
                        <CancellationCell tx={tx} onRequest={() => setCancelTarget(tx)} />
                      </td>
                    </tr>
                    {isExpanded && hasItems && (
                      <tr key={`${tx._id}-items`} className="purchases-row-expanded">
                        <td colSpan={COLUMN_COUNT} className="p-0 border-t border-border">
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

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) closeCancelDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request to cancel this order</DialogTitle>
            <DialogDescription>
              The store has to approve your request. Your order stays active until they do.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Order:</span>{' '}
                  <span className="font-mono">{cancelTarget._id.slice(-8)}</span> · {getStoreName(cancelTarget.storeId)}
                </p>
                <p>
                  <span className="text-muted-foreground">Total:</span>{' '}
                  <span className="font-medium">{fmt(cancelTarget.totalAmount)}</span>
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cancel-reason" className="text-xs">
                  Why do you want to cancel? <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Tell the store why (at least 2 words)..."
                  maxLength={500}
                  rows={3}
                  className="resize-none"
                  aria-invalid={cancelReason.length > 0 && reasonTooShort}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className={cancelReason.length > 0 && reasonTooShort ? 'text-destructive' : ''}>
                    Required — minimum of 2 words.
                  </span>
                  <span>{cancelReason.length}/500</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeCancelDialog} disabled={cancelSubmitting}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              onClick={submitCancelRequest}
              disabled={cancelSubmitting || reasonTooShort}
            >
              {cancelSubmitting && <Spinner data-icon="inline-start" />}
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

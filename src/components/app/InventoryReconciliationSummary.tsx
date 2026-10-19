import { useEffect, useState } from 'react';

export interface ReconciliationPreview {
  productId: string;
  name: string;
  stockQuantity: number;
  reservedQuantity: number;
  physical: number;
  outstanding: number;
  additionalNeeded: number;
  paidOrders: number;
  unpaidOrders: number;
  cancelledOrders: number;
  paidUnits: number;
  unpaidUnits: number;
  cancelledUnits: number;
}

export function liveReconciliation(physical: number, outstanding: number, received: number) {
  const safeReceived = Number.isFinite(received) ? Math.max(0, received) : 0;
  const total = physical + safeReceived;
  return {
    additionalNeeded: Math.max(0, outstanding - physical),
    total,
    shortage: Math.max(0, outstanding - total),
    available: total - outstanding,
    reserved: outstanding,
  };
}

export function receivedUnits(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

export function useReconciliationPreview(productId: string | null) {
  const [preview, setPreview] = useState<ReconciliationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setPreview(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/inventory/reconciliation/${productId}`)
      .then(async (res) => {
        const data = (await res.json()) as ReconciliationPreview & { message?: string };
        if (!res.ok) throw new Error(data.message ?? 'Could not load stock');
        return data;
      })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreview(null);
        setError(err instanceof Error ? err.message : 'Could not load stock');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  return { preview, loading, error };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function InventoryReconciliationSummary({
  preview,
  loading,
  error,
  received,
  mode,
}: {
  preview: ReconciliationPreview | null;
  loading: boolean;
  error: string | null;
  received?: number | null;
  mode: 'inventory' | 'hold';
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading stock…</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!preview) return null;

  const live = mode === 'inventory' && received != null
    ? liveReconciliation(preview.physical, preview.outstanding, received)
    : null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <Row label="Physical stock" value={String(preview.physical)} />
      <Row
        label="Outstanding pre-orders"
        value={`${preview.outstanding} (${preview.paidOrders} paid, ${preview.unpaidOrders} unpaid, ${preview.cancelledOrders} cancelled)`}
      />
      <p className="text-xs text-muted-foreground">
        Paid {preview.paidUnits}, unpaid {preview.unpaidUnits}, cancelled {preview.cancelledUnits} units.
        Cancelled orders are not outstanding.
      </p>
      {mode === 'hold' ? (
        <p className="text-xs text-muted-foreground">
          This does not change stock. Physical stock stays held until the product is listed for regular sales.
        </p>
      ) : live && received != null ? (
        <>
          <Row label="Additional stock needed" value={String(live.additionalNeeded)} />
          <Row label="Received" value={String(received)} />
          <Row label="Reserved for pre-orders" value={live.shortage > 0 ? '—' : String(live.reserved)} />
          <Row label="Available for regular sales" value={live.shortage > 0 ? '—' : String(live.available)} />
          {live.shortage > 0 && (
            <p className="text-sm text-destructive">Short by {live.shortage}. Receive more before listing this for regular sales.</p>
          )}
        </>
      ) : (
        <Row label="Additional stock needed" value={String(preview.additionalNeeded)} />
      )}
    </div>
  );
}

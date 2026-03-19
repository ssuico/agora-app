import { useEffect, useState } from 'react';
import { Check, HelpCircle, Lightbulb, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import toast from 'react-hot-toast';

type InteractionType = 'recommendation' | 'question';
type InteractionStatus = 'pending' | 'responded';
type FilterType = 'all' | InteractionType;

interface Interaction {
  _id: string;
  storeId: string;
  userId?: { name: string } | null;
  guestName?: string | null;
  type: InteractionType;
  content: string;
  status: InteractionStatus;
  response?: string | null;
  createdAt: string;
}

interface CustomerInteractionsProps {
  storeId: string;
}

function timeAgo(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function CustomerInteractions({ storeId }: CustomerInteractionsProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | InteractionStatus>('all');
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ storeId, limit: '50' });
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);

      const res = await fetch(`/api/interactions?${params}`);
      if (!res.ok) throw new Error('Failed to load interactions');
      const json = await res.json();
      setInteractions(json.interactions ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading interactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [storeId, filterType, filterStatus]);

  const handleMarkResponded = async (id: string, currentStatus: InteractionStatus) => {
    const nextStatus: InteractionStatus = currentStatus === 'pending' ? 'responded' : 'pending';
    setMarkingId(id);
    try {
      const res = await fetch(`/api/interactions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json() as Interaction;
      setInteractions((prev) =>
        prev.map((i) => (i._id === id ? { ...i, status: updated.status } : i))
      );
      toast.success(nextStatus === 'responded' ? 'Marked as responded' : 'Marked as pending');
    } catch {
      toast.error('Failed to update status');
    } finally {
      setMarkingId(null);
    }
  };

  const pendingCount = interactions.filter((i) => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Customer Interactions</h2>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'question', 'recommendation'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterType === t
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {t === 'all' ? 'All' : t === 'question' ? 'Questions' : 'Recommendations'}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {(['all', 'pending', 'responded'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : interactions.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center">
          <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No interactions found</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{total} total</p>
          <div className="space-y-3">
            {interactions.map((item) => {
              const authorName = item.userId?.name ?? item.guestName ?? 'Anonymous';
              return (
                <div
                  key={item._id}
                  className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                        {item.type === 'question' ? (
                          <HelpCircle className="h-3.5 w-3.5 text-blue-500" />
                        ) : (
                          <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{authorName}</span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 capitalize"
                          >
                            {item.type}
                          </Badge>
                          <Badge
                            variant={item.status === 'pending' ? 'destructive' : 'secondary'}
                            className="text-[10px] px-1.5 py-0 capitalize"
                          >
                            {item.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {timeAgo(item.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">{item.content}</p>
                        {item.response && (
                          <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                            <span className="font-medium">Response: </span>
                            {item.response}
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant={item.status === 'pending' ? 'outline' : 'ghost'}
                      size="sm"
                      className="shrink-0 gap-1 text-xs"
                      disabled={markingId === item._id}
                      onClick={() => handleMarkResponded(item._id, item.status)}
                    >
                      {markingId === item._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      {item.status === 'pending' ? 'Mark Responded' : 'Reopen'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

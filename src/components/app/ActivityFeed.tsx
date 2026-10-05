import { useEffect, useRef, useState } from 'react';
import { Activity, ShoppingBag, Star, Zap } from 'lucide-react';
import { getSocket } from '@/lib/socket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityLogEntry {
  _id: string;
  storeId: string;
  type: 'reservation_created' | 'rating_submitted';
  actorName: string;
  actorAvatar?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface ActivityFeedProps {
  storeId: string;
}

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Derive two-letter initials from a name */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Deterministic background color from a string */
const AVATAR_COLORS = [
  'bg-operational text-operational-foreground',
  'bg-muted text-foreground',
  'bg-primary-subtle text-foreground',
  'bg-operational-subtle text-operational',
  'bg-border text-foreground',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ActivityTypeIcon({ type }: { type: ActivityLogEntry['type'] }) {
  if (type === 'reservation_created')
    return <ShoppingBag className="size-2.5 text-card" />;
  if (type === 'rating_submitted')
    return <Star className="size-2.5 text-card" />;
  return <Zap className="size-2.5 text-card" />;
}

function typeBadgeColor(type: ActivityLogEntry['type']): string {
  if (type === 'reservation_created') return 'bg-operational';
  if (type === 'rating_submitted') return 'bg-warning';
  return 'bg-muted-foreground';
}

function ActorAvatar({ name, avatar, type }: { name: string; avatar?: string | null; type: ActivityLogEntry['type'] }) {
  return (
    <div className="relative mt-0.5 shrink-0">
      <Avatar>
        {avatar && <AvatarImage src={avatar} alt={name} className="object-cover" />}
        <AvatarFallback className={`text-xs font-semibold ${getAvatarColor(name)}`}>
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>
      {/* Type badge — bottom-right of avatar */}
      <span className={`absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full ring-2 ring-card ${typeBadgeColor(type)}`}>
        <ActivityTypeIcon type={type} />
      </span>
    </div>
  );
}

const MAX_ENTRIES = 10;

export function ActivityFeed({ storeId }: ActivityFeedProps) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch initial logs
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/activity-logs?storeId=${storeId}&limit=${MAX_ENTRIES}`, {
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ActivityLogEntry[]) => setEntries(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [storeId]);

  // Socket listener
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:store', storeId);

    const handler = (entry: ActivityLogEntry) => {
      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));

      // Mark as fresh so the enter animation plays
      setFreshIds((prev) => new Set([...prev, entry._id]));
      setTimeout(() => {
        setFreshIds((prev) => {
          const next = new Set(prev);
          next.delete(entry._id);
          return next;
        });
      }, 800);

      // Scroll list to top so the new item is visible
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      });
    };
    socket.on('activity:new', handler);

    return () => {
      socket.off('activity:new', handler);
      socket.emit('leave:store', storeId);
    };
  }, [storeId]);

  // Tick every 10s to update relative timestamps
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  return (
    <div className="shop-widget">
      {/* Header */}
      <div className="shop-widget-header flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-lg bg-operational-subtle">
          <Activity className="size-3.5 text-operational" />
        </div>
        <h3 className="text-sm font-semibold">Recent Activity</h3>
        {entries.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            {/* Live pulse dot */}
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex size-full rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            <Badge variant="secondary" className="px-1.5 text-[10px] font-semibold">
              {entries.length}
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={scrollRef} className="shop-widget-scroll max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5 pt-1">
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-2.5 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <Empty className="p-6 md:p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Activity />
              </EmptyMedia>
              <EmptyDescription>No activity yet</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="divide-y divide-border pb-9">
            {entries.map((entry, idx) => (
              <li
                key={entry._id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted ${
                  freshIds.has(entry._id)
                    ? 'animate-in slide-in-from-top-3 fade-in duration-300 bg-primary-subtle/40'
                    : idx === 0
                      ? 'bg-muted/60'
                      : ''
                }`}
              >
                <ActorAvatar
                  name={entry.actorName}
                  avatar={entry.actorAvatar}
                  type={entry.type}
                />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-xs text-foreground leading-snug">{entry.message}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {relativeTime(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

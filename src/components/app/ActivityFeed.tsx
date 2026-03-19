import { useEffect, useRef, useState } from 'react';
import { Activity, ShoppingBag, Star, Zap } from 'lucide-react';
import { getSocket } from '@/lib/socket';

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
  'bg-blue-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-green-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-indigo-500',
];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function ActivityTypeIcon({ type }: { type: ActivityLogEntry['type'] }) {
  if (type === 'reservation_created')
    return <ShoppingBag className="h-2.5 w-2.5 text-white" />;
  if (type === 'rating_submitted')
    return <Star className="h-2.5 w-2.5 text-white" />;
  return <Zap className="h-2.5 w-2.5 text-white" />;
}

function typeBadgeColor(type: ActivityLogEntry['type']): string {
  if (type === 'reservation_created') return 'bg-blue-500';
  if (type === 'rating_submitted') return 'bg-amber-500';
  return 'bg-muted-foreground';
}

function ActorAvatar({ name, avatar, type }: { name: string; avatar?: string | null; type: ActivityLogEntry['type'] }) {
  const [imgError, setImgError] = useState(false);
  const showImg = !!avatar && !imgError;

  return (
    <div className="relative mt-0.5 shrink-0">
      {/* Main avatar circle */}
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-semibold overflow-hidden ${showImg ? '' : getAvatarColor(name)}`}>
        {showImg ? (
          <img
            src={avatar!}
            alt={name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          getInitials(name)
        )}
      </div>
      {/* Type badge — bottom-right of avatar */}
      <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-card ${typeBadgeColor(type)}`}>
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
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Live Activity</h3>
        {entries.length > 0 && (
          <span className="ml-auto rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
            {entries.length}
          </span>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5 pt-1">
                  <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center">
            <Activity className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((entry) => (
              <li key={entry._id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
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

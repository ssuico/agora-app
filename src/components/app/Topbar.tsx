import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Clock, LogOut, User } from 'lucide-react';

interface TopbarProps {
  name: string;
  role: string;
  avatar?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  store_manager: 'Store Manager',
  customer: 'Customer',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-primary/35 bg-primary/10 text-primary',
  store_manager: 'border-accent/40 bg-accent/10 text-accent',
  customer: 'border-secondary/65 bg-secondary/35 text-foreground',
};

const EST_TIMEZONE = 'America/New_York';

function useEstClock() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted || !now) {
    return { time: '--:--:--', date: '--' };
  }

  const time = now.toLocaleTimeString('en-US', {
    timeZone: EST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const date = now.toLocaleDateString('en-US', {
    timeZone: EST_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return { time, date };
}

const PROFILE_UPDATED_EVENT = 'profile-updated';

export function Topbar({ name, role, avatar: initialAvatar }: TopbarProps) {
  const [avatar, setAvatar] = useState(initialAvatar ?? '');
  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatar(initialAvatar ?? '');
    setAvatarError(false);
  }, [initialAvatar]);

  useEffect(() => {
    const onProfileUpdated = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const me = (await res.json()) as { name?: string; role?: string; avatar?: string };
          if (me.avatar != null) setAvatar(typeof me.avatar === 'string' ? me.avatar : '');
          setAvatarError(false);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
  }, []);

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const { time, date } = useEstClock();
  const showAvatarImage = avatar?.trim() && !avatarError;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      toast.success('Signed out');
      window.location.href = '/login';
    } catch {
      toast.error('Sign out failed');
      window.location.href = '/login';
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/55 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-[0_12px_28px_-16px_rgba(38,42,86,0.95)]">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-primary-foreground" fill="currentColor">
            <path d="M12 2L3 9h18zM3 9h18v2H3zM5 11h2v8H5zM11 11h2v8h-2zM17 11h2v8h-2zM3 19h18v2H3z" />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">Agora</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-1.5 text-foreground/75 sm:flex">
          <Clock className="h-4 w-4" />
          <div className="text-sm leading-tight text-right">
            <p className="font-medium tabular-nums">{time}</p>
            <p className="text-xs text-foreground/60">{date}</p>
          </div>
        </div>
        <div className="hidden h-8 w-px bg-border/80 sm:block" />
        <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-2 py-1.5 outline-none transition hover:bg-primary/8">
          <div className="h-8 w-8 shrink-0 rounded-full ring-2 ring-primary/20 overflow-hidden flex items-center justify-center bg-secondary/50 text-xs font-semibold text-foreground">
            {showAvatarImage ? (
              <img
                src={avatar}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              initials
            )}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium leading-none">{name}</p>
            <Badge
              variant="outline"
              className={`mt-0.5 text-xs ${ROLE_COLORS[role] ?? ''}`}
            >
              {ROLE_LABELS[role] ?? role}
            </Badge>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border-border/70 bg-background/90 backdrop-blur-sm">
          <DropdownMenuItem asChild>
            <a href="/profile" className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Profile
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

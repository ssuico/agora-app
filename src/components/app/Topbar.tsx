import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from './ThemeToggle';
import { Check, ChevronDown, Clock, LogOut, User } from 'lucide-react';

interface TopbarProps {
  name: string;
  role: string;
  roles?: string[];
  avatar?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  store_manager: 'Store Manager',
  customer: 'Customer',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-primary/30 bg-primary-subtle text-foreground',
  store_manager: 'border-operational/30 bg-operational-subtle text-operational',
  customer: 'border-border bg-muted text-foreground',
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

const ROLE_ORDER = ['admin', 'store_manager', 'customer'];

export function Topbar({ name, role, roles = [], avatar: initialAvatar }: TopbarProps) {
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const switchableRoles = ROLE_ORDER.filter((r) => roles.includes(r));
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

  const handleSwitchView = async (target: string) => {
    if (target === role || switchingTo) return;
    setSwitchingTo(target);
    try {
      const res = await fetch('/api/auth/switch-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: target }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        toast.error(data.message ?? 'Could not switch view');
        setSwitchingTo(null);
        return;
      }
      window.location.href = '/';
    } catch {
      toast.error('Could not switch view');
      setSwitchingTo(null);
    }
  };

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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <svg viewBox="0 0 24 24" className="size-4.5 text-primary-foreground" fill="currentColor">
            <path d="M12 2L3 9h18zM3 9h18v2H3zM5 11h2v8H5zM11 11h2v8h-2zM17 11h2v8h-2zM3 19h18v2H3z" />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">Agora</span>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-muted-foreground sm:flex">
          <Clock className="size-4" />
          <div className="text-sm leading-tight text-right">
            <p className="font-medium tabular-nums text-foreground">{time}</p>
            <p className="text-xs">{date}</p>
          </div>
        </div>
        <ThemeToggle />
        <Separator orientation="vertical" className="hidden data-[orientation=vertical]:h-8 sm:block" />
        <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar>
            {showAvatarImage && (
              <AvatarImage
                src={avatar}
                alt=""
                className="object-cover"
                onLoadingStatusChange={(status) => {
                  if (status === 'error') setAvatarError(true);
                }}
              />
            )}
            <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium leading-none">{name}</p>
            <Badge
              variant="outline"
              className={`mt-0.5 text-xs ${ROLE_COLORS[role] ?? ''}`}
            >
              {ROLE_LABELS[role] ?? role}
            </Badge>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <a href="/profile" className="cursor-pointer">
                <User />
                Profile
              </a>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {switchableRoles.length > 1 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">Switch view</DropdownMenuLabel>
                {switchableRoles.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => handleSwitchView(r)}
                    disabled={switchingTo !== null}
                    aria-current={r === role ? 'true' : undefined}
                    className="cursor-pointer"
                  >
                    {r === role ? <Check /> : <span className="size-4" aria-hidden="true" />}
                    {ROLE_LABELS[r] ?? r}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={handleLogout} variant="destructive" className="cursor-pointer">
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

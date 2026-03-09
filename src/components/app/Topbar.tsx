import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Clock, LogOut } from 'lucide-react';

interface TopbarProps {
  name: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  store_manager: 'Store Manager',
  customer: 'Customer',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  store_manager: 'bg-blue-100 text-blue-700',
  customer: 'bg-green-100 text-green-700',
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

export function Topbar({ name, role }: TopbarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const { time, date } = useEstClock();

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
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm">
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-primary-foreground" fill="currentColor">
            <path d="M12 2L3 9h18zM3 9h18v2H3zM5 11h2v8H5zM11 11h2v8h-2zM17 11h2v8h-2zM3 19h18v2H3z" />
          </svg>
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">Agora</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <div className="text-sm leading-tight text-right">
            <p className="font-medium tabular-nums">{time}</p>
            <p className="text-xs">{date}</p>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent outline-none">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="text-left">
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
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

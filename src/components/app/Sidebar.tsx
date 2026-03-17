import {
  ChevronDown,
  Home,
  MapPin,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

function getNavItems(storeId?: string): NavItem[] {
  const adminItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: <Home className="h-4 w-4" />,
      roles: ['admin'],
    },
    {
      label: 'Locations',
      href: '/admin/locations',
      icon: <MapPin className="h-4 w-4" />,
      roles: ['admin'],
    },
    {
      label: 'Stores',
      href: '/admin/stores',
      icon: <Store className="h-4 w-4" />,
      roles: ['admin'],
    },
    {
      label: 'Users',
      href: '/admin/users',
      icon: <Users className="h-4 w-4" />,
      roles: ['admin'],
    },
  ];

  const storePrefix = storeId ? `/store/${storeId}` : '/store';
  const managerItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: storePrefix,
      icon: <Home className="h-4 w-4" />,
      roles: ['store_manager'],
    },
    {
      label: 'Inventory',
      href: `${storePrefix}/products`,
      icon: <Package className="h-4 w-4" />,
      roles: ['store_manager'],
    },
    {
      label: 'Transactions',
      href: `${storePrefix}/transactions`,
      icon: <ShoppingCart className="h-4 w-4" />,
      roles: ['store_manager'],
    },
  ];

  return [...adminItems, ...managerItems];
}

export interface AssignedStore {
  _id: string;
  name: string;
  locationName?: string;
}

interface SidebarProps {
  role: string;
  currentPath: string;
  storeId?: string;
  storeName?: string;
  storeLocation?: string;
  /** For store managers with multiple stores: list of stores they can switch to */
  assignedStores?: AssignedStore[];
}

export function Sidebar({ role, currentPath, storeId, storeName, storeLocation, assignedStores }: SidebarProps) {
  const items = getNavItems(storeId).filter((item) => item.roles.includes(role));
  const canSwitchStore =
    role === 'store_manager' &&
    storeId &&
    assignedStores &&
    assignedStores.length > 1;

  return (
    <aside className="app-surface flex h-full w-60 shrink-0 flex-col rounded-2xl">
      <div className="flex h-16 items-center gap-2.5 border-b border-emerald-900/10 px-5">
        <div className="inline-flex size-8 items-center justify-center rounded-lg bg-emerald-800 text-emerald-50 shadow-[0_12px_25px_-18px_rgba(18,98,50,0.95)]">
          <Receipt className="h-4 w-4" />
        </div>
        <span className="text-lg font-bold tracking-tight text-emerald-950">Agora</span>
      </div>

      {storeName && (
        <div className="border-b border-emerald-900/10 px-5 py-3">
          {canSwitchStore ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg py-1 pr-2 text-left outline-none transition hover:bg-emerald-900/5 focus-visible:ring-2 focus-visible:ring-emerald-700">
                <Store className="h-4 w-4 shrink-0 text-emerald-800" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-emerald-950">{storeName}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-emerald-800/70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 border-emerald-900/10 bg-white/95 backdrop-blur-sm">
                {assignedStores!.map((store) => (
                  <DropdownMenuItem
                    key={store._id}
                    className="cursor-pointer"
                    onClick={() => {
                      window.location.href = `/store/${store._id}`;
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className={store._id === storeId ? 'font-semibold' : ''}>{store.name}</span>
                      {store.locationName && (
                        <span className="text-xs text-muted-foreground">{store.locationName}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-emerald-800" />
              <span className="truncate text-sm font-semibold text-emerald-950">{storeName}</span>
            </div>
          )}
          {storeLocation && (
            <div className="mt-1 flex items-center gap-2 text-xs text-emerald-900/65">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{storeLocation}</span>
            </div>
          )}
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1.5 p-3">
        {items.map((item) => {
          const storeRoot = storeId ? `/store/${storeId}` : '';
          const isExactStoreRoot = storeRoot && item.href === storeRoot;
          const isActive =
            currentPath === item.href ||
            (!isExactStoreRoot && currentPath.startsWith(item.href + '/'));
          return (
            <a
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[linear-gradient(135deg,rgba(23,101,52,0.92),rgba(52,130,71,0.95))] text-emerald-50 shadow-[0_14px_30px_-22px_rgba(19,94,52,0.92)]'
                  : 'text-emerald-900/72 hover:bg-emerald-700/8 hover:text-emerald-950'
              }`}
            >
              {isActive && <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-white/90" />}
              {item.icon}
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

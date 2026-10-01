import {
  ChevronDown,
  Home,
  MapPin,
  Package,
  QrCode,
  Receipt,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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
      icon: <Home className="size-4" />,
      roles: ['admin'],
    },
    {
      label: 'Locations',
      href: '/admin/locations',
      icon: <MapPin className="size-4" />,
      roles: ['admin'],
    },
    {
      label: 'Stores',
      href: '/admin/stores',
      icon: <Store className="size-4" />,
      roles: ['admin'],
    },
    {
      label: 'Users',
      href: '/admin/users',
      icon: <Users className="size-4" />,
      roles: ['admin'],
    },
  ];

  const storePrefix = storeId ? `/store/${storeId}` : '/store';
  const managerItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: storePrefix,
      icon: <Home className="size-4" />,
      roles: ['store_manager'],
    },
    {
      label: 'Inventory',
      href: `${storePrefix}/products`,
      icon: <Package className="size-4" />,
      roles: ['store_manager'],
    },
    {
      label: 'Transactions',
      href: `${storePrefix}/transactions`,
      icon: <ShoppingCart className="size-4" />,
      roles: ['store_manager'],
    },
    {
      label: 'Payment Options',
      href: `${storePrefix}/payment-options`,
      icon: <QrCode className="size-4" />,
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
      <div className="flex h-16 items-center gap-2.5 border-b border-border/70 px-5">
        <div className="inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Receipt className="size-4" />
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">Agora</span>
      </div>

      {storeName && (
        <div className="border-b border-border/70 px-5 py-3">
          {canSwitchStore ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg py-1 pr-2 text-left outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                <Store className="size-4 shrink-0 text-operational" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{storeName}</span>
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuGroup>
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
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Store className="size-4 text-operational" />
              <span className="truncate text-sm font-semibold text-foreground">{storeName}</span>
            </div>
          )}
          {storeLocation && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3" />
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
              aria-current={isActive ? 'page' : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? 'bg-primary-subtle font-semibold text-foreground'
                  : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {isActive && <span className="absolute inset-y-2 left-1 w-1 rounded-full bg-primary" />}
              <span className={isActive ? 'text-primary' : undefined}>{item.icon}</span>
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

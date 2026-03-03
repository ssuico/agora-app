import {
  BarChart3,
  Home,
  MapPin,
  Package,
  Receipt,
  ShoppingCart,
  Store,
  Users,
} from 'lucide-react';

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
      label: 'Products',
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
    {
      label: 'Reports',
      href: `${storePrefix}/reports`,
      icon: <BarChart3 className="h-4 w-4" />,
      roles: ['store_manager'],
    },
  ];

  return [...adminItems, ...managerItems];
}

interface SidebarProps {
  role: string;
  currentPath: string;
  storeId?: string;
  storeName?: string;
  storeLocation?: string;
}

export function Sidebar({ role, currentPath, storeId, storeName, storeLocation }: SidebarProps) {
  const items = getNavItems(storeId).filter((item) => item.roles.includes(role));

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-5">
        <Receipt className="h-5 w-5 text-primary" />
        <span className="text-lg font-bold tracking-tight">Agora</span>
      </div>

      {storeName && (
        <div className="border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold truncate">{storeName}</span>
          </div>
          {storeLocation && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{storeLocation}</span>
            </div>
          )}
        </div>
      )}

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const isActive =
            currentPath === item.href || currentPath.startsWith(item.href + '/');
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {item.icon}
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

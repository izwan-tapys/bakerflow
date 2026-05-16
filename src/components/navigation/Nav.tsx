'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/orders', label: 'Orders', icon: '📋' },
  { href: '/dashboard/production', label: 'Production', icon: '🥣' },
  { href: '/dashboard/products', label: 'Menu', icon: '🧁' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

const inventoryNavItems = [
  { href: '/dashboard/inventory?tab=raw', label: 'Inventory', icon: '📦' },
  { href: '/dashboard/inventory?tab=shopping', label: 'Shopping', icon: '🛒' },
  { href: '/dashboard/inventory?tab=purchases', label: 'Purchases', icon: '🧾' },
  { href: '/dashboard/settings', label: 'Menu', icon: '⋮' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isInventoryPage = pathname.startsWith('/dashboard/inventory');
  const currentItems = isInventoryPage ? inventoryNavItems : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-muted safe-area-pb md:hidden">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {currentItems.map(item => {
          // Special active logic for inventory tabs
          const isActive = isInventoryPage 
            ? (item.label === 'Menu' ? pathname === '/dashboard/settings' : pathname === '/dashboard/inventory')
            : (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)));
            
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 h-full transition-all ${
                isActive ? 'text-primary' : 'text-foreground/40'
              }`}
            >
              <span className={`text-xl transition-transform font-bold ${isActive ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-black uppercase tracking-wider transition-all ${isActive ? 'text-primary' : 'text-foreground/40'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-muted p-6 space-y-8 min-h-screen">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-black text-[10px] text-center leading-tight">BA<br/>BE</div>
        <span className="text-xl font-black text-foreground">BakersBestie</span>
      </div>
      <nav className="flex-1 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-foreground/60 hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all text-sm font-medium"
      >
        🚪 Log Out
      </button>
    </aside>
  );
}

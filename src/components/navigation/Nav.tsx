'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useState, useEffect } from 'react';

// Main bottom nav items
const navItems: { href?: string; id?: string; label: string; icon: string }[] = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { id: 'office', label: 'Office', icon: '🏢' },
  { id: 'kitchen', label: 'Kitchen', icon: '🥣' },
  { id: 'delivery', label: 'Delivery', icon: '🚚' },
  { id: 'more', label: 'More', icon: '⋮' },
];

// Sub-links for each hub
const hubLinks: Record<string, { href: string; label: string; icon: string }[]> = {
  office: [
    { href: '/office/orders', label: 'Orders', icon: '📋' },
    { href: '/office/analytics', label: 'Analytics', icon: '📊' },
    { href: '/office/directory', label: 'Directory', icon: '📇' },
    { href: '/office/settings', label: 'Settings', icon: '⚙️' },
  ],
  kitchen: [
    { href: '/kitchen/production', label: 'Tasks', icon: '🍳' },
    { href: '/kitchen/planner', label: 'Planner', icon: '📅' },
    { href: '/kitchen/inventory', label: 'Inventory', icon: '📦' },
    { href: '/kitchen/products', label: 'Products', icon: '🧁' },
    { href: '/kitchen/settings', label: 'Settings', icon: '⚙️' },
  ],
  delivery: [
    { href: '/delivery', label: 'Delivery', icon: '🚚' },
    { href: '/delivery/settings', label: 'Settings', icon: '⚙️' },
  ],
};

// Desktop sidebar nav with children
const sideNavItems: { href?: string; id: string; label: string; icon: string; children?: { href: string; label: string; icon: string }[] }[] = [
  { href: '/dashboard', id: 'home', label: 'Home', icon: '🏠' },
  { 
    id: 'office', 
    label: 'Office', 
    icon: '🏢',
    children: hubLinks.office
  },
  { 
    id: 'kitchen', 
    label: 'Kitchen', 
    icon: '🥣',
    children: hubLinks.kitchen
  },
  { href: '/delivery', id: 'delivery', label: 'Delivery', icon: '🚚' },
  { href: '/dashboard/settings', id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [userData, setUserData] = useState<{ name: string; plan: string } | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData({
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Baker',
          plan: 'Premium Plan 👑',
        });
      }
    };
    fetchUser();
  }, []);

  // Auto-detect active hub from pathname
  useEffect(() => {
    setActivePopup(null);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isInHub = (hub: string) => {
    if (hub === 'office') return pathname.startsWith('/office');
    if (hub === 'kitchen') return pathname.startsWith('/kitchen');
    if (hub === 'delivery') return pathname.startsWith('/delivery');
    return false;
  };

  const currentHub = activePopup || 
    (pathname.startsWith('/office') ? 'office' : 
     pathname.startsWith('/kitchen') ? 'kitchen' : 
     pathname.startsWith('/delivery') ? 'delivery' : null);

  const subLinks = currentHub && hubLinks[currentHub] ? hubLinks[currentHub] : [];

  return (
    <>
      {/* Second sub-nav bar — appears above main nav when in a hub or popup is open */}
      {subLinks.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 bg-white border-t-2 border-primary/20 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)] md:hidden animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-around max-w-lg mx-auto px-4 py-1.5 gap-2">
            {subLinks.map(link => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setActivePopup(null)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground/40 hover:text-foreground/70'
                  }`}
                >
                  <span className="text-base">{link.icon}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${isActive ? 'text-primary' : ''}`}>
                    {link.label}
                  </span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-primary" />}
                </Link>
              );
            })}
            {/* Dismiss button when popup is open but not in that hub */}
            {activePopup && !isInHub(activePopup) && (
              <button
                onClick={() => setActivePopup(null)}
                className="w-8 h-8 flex items-center justify-center text-foreground/20 hover:text-foreground/40 transition-all"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Backdrop for dismissing popup — active whenever a popup is shown */}
      {activePopup && (
        <div
          className="fixed inset-0 z-30 md:hidden bg-black/5 backdrop-blur-[1px]"
          onClick={() => setActivePopup(null)}
        />
      )}

      {/* Main bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-muted safe-area-pb md:hidden">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {navItems.map(item => {
            const isActive = item.href
              ? pathname === item.href
              : item.id ? isInHub(item.id) || activePopup === item.id
              : false;

            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.href) {
                    router.push(item.href);
                    setActivePopup(null);
                  } else if (item.id === 'more') {
                    setShowMore(true);
                    setActivePopup(null);
                  } else if (item.id) {
                    // Toggle sub-bar
                    setActivePopup(prev => prev === item.id ? null : item.id!);
                  }
                }}
                className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all flex-1 ${
                  isActive ? 'text-primary' : 'text-foreground/40'
                }`}
              >
                <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider ${isActive ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-sm shadow-primary/40" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* More Menu Bottom Sheet */}
      {showMore && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-20 md:hidden animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowMore(false)} />

          <div className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl border border-muted/50 overflow-hidden animate-in slide-in-from-bottom-full duration-300">
            <div className="pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1.5 bg-muted rounded-full" />
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
                  { label: 'Analytics', icon: '📊', href: '/office/analytics' },
                  { label: 'Directory', icon: '📇', href: '/office/directory' },
                  { label: 'Feedback', icon: '💬', href: '#' },
                ].map(link => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-2xl border border-muted/50 hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95"
                  >
                    <span className="text-2xl mb-1">{link.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">{link.label}</span>
                  </Link>
                ))}
              </div>

              {/* User Card */}
              <div className="bg-primary/5 rounded-3xl p-5 border border-primary/10 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-lg shadow-primary/20">
                  {userData?.name?.[0]?.toUpperCase() ?? 'B'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground truncate">{userData?.name}</p>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{userData?.plan}</p>
                </div>
                <button
                  onClick={() => { handleLogout(); setShowMore(false); }}
                  className="w-10 h-10 bg-white border border-muted rounded-xl flex items-center justify-center text-red-500 hover:bg-red-50 transition-all shadow-sm"
                >
                  🚪
                </button>
              </div>

              <button
                onClick={() => setShowMore(false)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 hover:text-foreground transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-muted p-6 space-y-8 min-h-screen sticky top-0 h-screen overflow-y-auto">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-black text-[10px] text-center leading-tight">BA<br />KE</div>
        <span className="text-xl font-black text-foreground">BakerFlow</span>
      </div>
      
      <nav className="flex-1 space-y-1">
        {sideNavItems.map(item => {
          const isHubActive = item.href 
            ? pathname === item.href 
            : pathname.startsWith(`/${item.id}`);
          
          return (
            <div key={item.id} className="space-y-1">
              <Link
                href={item.href || item.children?.[0]?.href || '#'}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${
                  isHubActive
                    ? 'bg-primary/5 text-primary'
                    : 'text-foreground/60 hover:bg-muted hover:text-foreground'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>

              {/* Render Children if Hub is active */}
              {item.children && isHubActive && (
                <div className="ml-9 space-y-1 animate-in slide-in-from-top-1 duration-200">
                  {item.children.map(child => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          isChildActive
                            ? 'text-primary border-r-2 border-primary'
                            : 'text-foreground/40 hover:text-foreground/70'
                        }`}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground/40 hover:text-red-500 hover:bg-red-50 transition-all text-sm font-medium border-t border-muted/50 pt-6"
      >
        🚪 Log Out
      </button>
    </aside>
  );
}

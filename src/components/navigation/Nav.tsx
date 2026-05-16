'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';


const navItems: { href?: string; id?: string; label: string; icon: string }[] = [
  { href: '/dashboard', label: 'Office', icon: '🏢' },
  { href: '/dashboard/production', label: 'Kitchen', icon: '🥣' },
  { href: '/dashboard/delivery', label: 'Delivery', icon: '🚚' },
  { id: 'more', label: 'More', icon: '⋮' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [showMore, setShowMore] = useState(false);
  const [userData, setUserData] = useState<{name: string, plan: string} | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData({
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Baker',
          plan: 'Premium Plan 👑' // Hardcoded for now, or fetch from DB
        });
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-muted safe-area-pb md:hidden">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {navItems.map(item => {
            const isActive = item.href
              ? item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname === '/dashboard/orders' || pathname === '/dashboard/analytics' || pathname === '/dashboard/directory'
                : pathname.startsWith(item.href)
              : false;

            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.id === 'more') {
                    setShowMore(true);
                  } else if (item.href) {
                    router.push(item.href);
                  }
                }}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all flex-1 ${
                  isActive ? 'text-primary' : 'text-foreground/40'
                }`}
              >
                <span className={`text-xl transition-transform ${isActive ? 'scale-110 font-bold' : ''}`}>
                  {item.icon}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider transition-all ${isActive ? 'text-primary' : 'text-foreground/40'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-0.5 shadow-sm shadow-primary/40" />
                )}
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
            {/* Header / Handle */}
            <div className="pt-3 pb-2 flex justify-center">
              <div className="w-12 h-1.5 bg-muted rounded-full" />
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Settings', icon: '⚙️', href: '/dashboard/settings' },
                  { label: 'Analytics', icon: '📊', href: '/dashboard/analytics' },
                  { label: 'Directory', icon: '📇', href: '/dashboard/directory' },
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
                  {userData?.name[0].toUpperCase()}
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
                Close Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useEffect } from 'react';

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

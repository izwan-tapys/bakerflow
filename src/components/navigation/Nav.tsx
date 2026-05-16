'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  ChefHat, 
  Truck, 
  MoreHorizontal, 
  LayoutDashboard, 
  Package, 
  Calendar, 
  Box, 
  Settings, 
  BarChart3, 
  Users,
  Moon,
  Sun,
  ClipboardList,
  LogOut,
  ExternalLink
} from 'lucide-react';

// Main bottom nav items
const navItems = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'office', label: 'Office', icon: Building2 },
  { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  { id: 'delivery', label: 'Delivery', icon: Truck },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const hubLinks: Record<string, { href: string; label: string; icon: any }[]> = {
  office: [
    { href: '/office/orders', label: 'Orders', icon: ClipboardList },
    { href: '/office/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/office/directory', label: 'Directory', icon: Users },
    { href: '/office/settings', label: 'Settings', icon: Settings },
  ],
  kitchen: [
    { href: '/kitchen/production', label: 'Tasks', icon: ChefHat },
    { href: '/kitchen/planner', label: 'Planner', icon: Calendar },
    { href: '/kitchen/inventory', label: 'Inventory', icon: Box },
    { href: '/kitchen/products', label: 'Products', icon: Package },
    { href: '/kitchen/settings', label: 'Settings', icon: Settings },
  ],
  delivery: [
    { href: '/delivery', label: 'Delivery', icon: Truck },
    { href: '/delivery/settings', label: 'Settings', icon: Settings },
  ]
};

const sideNavItems = [
  { href: '/dashboard', id: 'home', label: 'Home', icon: LayoutDashboard },
  { 
    id: 'office', 
    label: 'Office', 
    icon: Building2,
    children: [
      { href: '/office/orders', label: 'Orders' },
      { href: '/office/analytics', label: 'Analytics' },
      { href: '/office/directory', label: 'Directory' },
      { href: '/office/settings', label: 'Settings' }
    ]
  },
  { 
    id: 'kitchen', 
    label: 'Kitchen', 
    icon: ChefHat,
    children: [
      { href: '/kitchen/production', label: 'Production' },
      { href: '/kitchen/planner', label: 'Planner' },
      { href: '/kitchen/inventory', label: 'Inventory' },
      { href: '/kitchen/products', label: 'Products' },
      { href: '/kitchen/settings', label: 'Settings' }
    ]
  },
  { 
    id: 'delivery', 
    label: 'Delivery', 
    icon: Truck,
    children: [
      { href: '/delivery', label: 'Delivery' },
      { href: '/delivery/settings', label: 'Settings' }
    ]
  }
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [activePopup, setActivePopup] = useState<'office' | 'kitchen' | 'delivery' | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [dismissedHubs, setDismissedHubs] = useState<string[]>([]);
  const [userData, setUserData] = useState<{ name: string; plan: string } | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    setTheme(savedTheme);
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData({ name: user.user_metadata?.shop_name || 'Baker', plan: 'Pro Baker' });
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    setActivePopup(null);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const isInHub = (hub: string) => pathname.startsWith(`/${hub}`);
  const toggleHub = (hub: any) => {
    if (activePopup === hub) {
      setActivePopup(null);
      setDismissedHubs(prev => [...prev, hub]);
    } else {
      setActivePopup(hub);
      setDismissedHubs(prev => prev.filter(h => h !== hub));
    }
  };

  return (
    <>
      <AnimatePresence>
        {activePopup && hubLinks[activePopup] && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-20 left-4 right-4 z-[70] md:hidden"
          >
            <div className="bg-card rounded-xl p-5 shadow-lg border border-primary/10 backdrop-blur-xl">
              <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{activePopup} Hub</span>
                <button onClick={() => setActivePopup(null)} className="text-foreground/20 text-xs">Close</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {hubLinks[activePopup].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setActivePopup(null)}
                    className="flex flex-col items-center justify-center p-3 bg-muted/30 rounded-xl border border-muted/50 hover:bg-primary/5 transition-all group"
                  >
                    <link.icon className="w-5 h-5 mb-1 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest text-foreground/60">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activePopup && (
        <div className="fixed inset-0 z-[60] bg-black/5 backdrop-blur-[1px]" onClick={() => setActivePopup(null)} />
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-primary/5 safe-area-pb md:hidden">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {navItems.map(item => {
            const isActive = item.href ? pathname === item.href : activePopup === item.id;
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.href) router.push(item.href);
                  else if (item.id === 'more') setShowMore(true);
                  else toggleHub(item.id);
                }}
                className={`flex flex-col items-center gap-1 py-1 flex-1 transition-all relative ${isActive ? 'text-primary' : 'text-foreground/30'}`}
              >
                <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-primary/5' : ''}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''}`} />
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeDot" 
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_rgba(139,94,60,0.5)]" 
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <AnimatePresence>
        {showMore && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center px-4 pb-20 md:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMore(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="relative w-full max-w-md bg-card rounded-xl border border-muted/50 p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Settings', icon: Settings, href: '/dashboard/settings' },
                  { label: 'Analytics', icon: BarChart3, href: '/office/analytics' },
                  { label: 'Directory', icon: Users, href: '/office/directory' },
                  { label: theme === 'light' ? 'Dark Mode' : 'Light Mode', icon: theme === 'light' ? Moon : Sun, onClick: toggleTheme },
                ].map(link => (
                  link.href ? (
                    <Link key={link.label} href={link.href} onClick={() => setShowMore(false)} className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl border border-muted/50 group">
                      <link.icon className="w-8 h-8 mb-2 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">{link.label}</span>
                    </Link>
                  ) : (
                    <button key={link.label} onClick={() => { link.onClick?.(); setShowMore(false); }} className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-xl border border-muted/50 group">
                      <link.icon className="w-8 h-8 mb-2 text-primary group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">{link.label}</span>
                    </button>
                  )
                ))}
              </div>
              <div className="bg-primary/5 rounded-xl p-5 border border-primary/10 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-black">{userData?.name?.[0]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-foreground truncate">{userData?.name}</p>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{userData?.plan}</p>
                </div>
                <button onClick={handleLogout} className="w-10 h-10 bg-card border border-muted/50 rounded-lg flex items-center justify-center text-red-500 shadow-sm"><LogOut className="w-5 h-5" /></button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
    <aside className="hidden md:flex flex-col w-64 bg-card border-r border-muted/50 p-6 space-y-8 min-h-screen sticky top-0 h-screen">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white font-black text-[10px] text-center leading-tight">BA<br />KE</div>
        <span className="text-xl font-black text-foreground">BakerFlow</span>
      </div>
      
      <nav className="flex-1 space-y-1">
        {sideNavItems.map(item => {
          const isHubActive = item.href ? pathname === item.href : pathname.startsWith(`/${item.id}`);
          const Icon = item.icon;
          return (
            <div key={item.id} className="space-y-1">
              <Link href={item.href || item.children?.[0]?.href || '#'} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isHubActive ? 'bg-primary/5 text-primary' : 'text-foreground/60 hover:bg-muted hover:text-foreground'}`}>
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
              {item.children && isHubActive && (
                <div className="ml-9 space-y-1">
                  {item.children.map(child => (
                    <Link key={child.href} href={child.href} className={`flex items-center px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${pathname === child.href ? 'text-primary' : 'text-foreground/40 hover:text-foreground/70'}`}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-foreground/40 hover:text-red-500 transition-all text-sm font-medium border-t border-muted/20 pt-6">
        <LogOut className="w-5 h-5" />
        Log Out
      </button>
    </aside>
  );
}
